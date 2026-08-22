package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionClassificationTestResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseMapper;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;

import java.util.Optional;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QuestionBankServiceTest {
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final DuplicateCheckService duplicateCheckService = mock(DuplicateCheckService.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final QuestionClassificationRuleService classificationRuleService = mock(QuestionClassificationRuleService.class);
    private final ExamPaperQuestionRepository examPaperQuestionRepository = mock(ExamPaperQuestionRepository.class);
    private final AtomicLong ids = new AtomicLong(10);
    private QuestionBankService service;

    @BeforeEach
    void setUp() {
        service = new QuestionBankService(
                questionRepository,
                new ParaphraseMapper(),
                duplicateCheckService,
                embeddingService,
                classificationRuleService,
                examPaperQuestionRepository
        );
        when(duplicateCheckService.check(anyString())).thenReturn(new DuplicateCheckResult(0.2, null, null, false, false));
        when(duplicateCheckService.check(anyString(), any())).thenReturn(new DuplicateCheckResult(0.2, null, null, false, false));
        when(classificationRuleService.classifyQuestion(anyString(), any(), any(), any(), any()))
                .thenReturn(new QuestionClassificationTestResponse(null, null, null, "Chưa phân loại", 0, "Không khớp"));
        when(examPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus(any(), eq(ExamPaperStatus.PUBLISHED))).thenReturn(0L);
        when(questionRepository.save(any(QuestionBankQuestion.class))).thenAnswer(invocation -> {
            QuestionBankQuestion question = invocation.getArgument(0);
            if (question.getId() == null) {
                question.setId(ids.incrementAndGet());
            }
            return question;
        });
    }

    @Test
    void createApprovedQuestionPersistsAndSavesEmbedding() {
        var response = service.create(validRequest("APPROVED"), "admin");

        assertThat(response.id()).isNotNull();
        assertThat(response.status()).isEqualTo(QuestionBankStatus.APPROVED.name());
        assertThat(response.statusText()).isEqualTo("Đã duyệt");
        assertThat(response.correctAnswer()).isEqualTo("A");
        verify(questionRepository).save(any(QuestionBankQuestion.class));
        // Câu mới đi đường save (chỉ THÊM vào cache), không phải refresh (xoá sạch cache rồi nạp
        // lại cả bảng) — nếu không, import N dòng thành O(N²) lượt đọc DB.
        verify(embeddingService).saveStemEmbedding(any(QuestionBankQuestion.class));
        verify(embeddingService, never()).refreshStemEmbedding(any(QuestionBankQuestion.class));
    }

    @Test
    void createPersistsIndependentFieldAndVerifiedCognitiveLevel() {
        QuestionCategoryRepository categoryRepository = mock(QuestionCategoryRepository.class);
        ProfessionalFieldRepository fieldRepository = mock(ProfessionalFieldRepository.class);
        QuestionCategory category = QuestionCategory.builder()
                .id(71L)
                .code("ATNB")
                .name("An toàn người bệnh")
                .status(QuestionCategoryStatus.ACTIVE)
                .build();
        ProfessionalField field = ProfessionalField.builder()
                .id(81L)
                .code("HSCC")
                .name("Hồi sức cấp cứu")
                .active(true)
                .build();
        when(categoryRepository.findById(71L)).thenReturn(Optional.of(category));
        when(fieldRepository.findById(81L)).thenReturn(Optional.of(field));
        service.setQuestionCategoryRepository(categoryRepository);
        service.setProfessionalFieldRepository(fieldRepository);

        var response = service.create(new UpsertQuestionBankQuestionRequest(
                "Dấu hiệu ưu tiên đánh giá sốc là gì?",
                "A", "B", "C", "D", "A",
                "Giải thích", "vi", "Tài liệu A", "APPROVED",
                71L, 81L, CognitiveLevel.CLINICAL_APPLICATION.name(), null
        ), "reviewer-01");

        assertThat(response.categoryId()).isEqualTo(71L);
        assertThat(response.professionalFieldId()).isEqualTo(81L);
        assertThat(response.cognitiveLevel()).isEqualTo(CognitiveLevel.CLINICAL_APPLICATION.name());
        assertThat(response.cognitiveVerifiedAt()).isNotNull();
        assertThat(response.cognitiveVerifiedBy()).isEqualTo("reviewer-01");
    }

    @Test
    void approveRejectsQuestionWithoutVerifiedCognitiveClassification() {
        QuestionBankQuestion question = existingQuestion();
        question.setProfessionalField(ProfessionalField.builder()
                .id(81L).code("HSCC").name("Hồi sức cấp cứu").active(true).build());
        question.setCognitiveLevel(null);
        question.setStatus(QuestionBankStatus.DRAFT);
        when(questionRepository.findById(question.getId())).thenReturn(Optional.of(question));

        assertThatThrownBy(() -> service.approve(question.getId(), "reviewer-01"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("mức độ nhận thức");
    }

    @Test
    void updateQuestionExcludesItselfFromDuplicateCheck() {
        QuestionBankQuestion existing = existingQuestion();
        when(questionRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var response = service.update(existing.getId(), validRequest("APPROVED"), "admin");

        assertThat(response.id()).isEqualTo(existing.getId());
        assertThat(response.stem()).contains("xác định người bệnh");
        assertThat(response.impactWarning()).isNotNull();
        verify(duplicateCheckService).check(eq(response.stem()), eq(Set.of(existing.getId())));
        verify(embeddingService).refreshStemEmbedding(existing);
    }

    @Test
    void archiveQuestionMarksQuestionArchived() {
        QuestionBankQuestion existing = existingQuestion();
        when(questionRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        var response = service.archive(existing.getId());

        assertThat(response.status()).isEqualTo(QuestionBankStatus.ARCHIVED.name());
        assertThat(existing.getStatus()).isEqualTo(QuestionBankStatus.ARCHIVED);
    }

    @Test
    void getQuestionReturnsImpactWarning() {
        QuestionBankQuestion existing = existingQuestion();
        when(questionRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(examPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus(existing, ExamPaperStatus.PUBLISHED)).thenReturn(1L);

        var response = service.get(existing.getId());

        assertThat(response.stem()).isEqualTo("Câu hỏi cũ");
        assertThat(response.optionA()).isEqualTo("A");
        assertThat(response.optionB()).isEqualTo("B");
        assertThat(response.optionC()).isEqualTo("C");
        assertThat(response.optionD()).isEqualTo("D");
        assertThat(response.correctAnswer()).isEqualTo("A");
        assertThat(response.explanation()).isEqualTo("Giải thích");
        assertThat(response.sourceDocument()).isEqualTo("Nhập thủ công");
        assertThat(response.statusText()).isEqualTo("Đã duyệt");
        assertThat(response.impactWarning()).isNotNull();
        assertThat(response.impactWarning().publishedExamPaperCount()).isEqualTo(1);
        assertThat(response.impactWarning().blocksArchive()).isTrue();
    }

    @Test
    void archiveQuestionRejectsWhenQuestionIsUsedByPublishedPaper() {
        QuestionBankQuestion existing = existingQuestion();
        when(questionRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(examPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus(existing, ExamPaperStatus.PUBLISHED)).thenReturn(1L);

        assertThatThrownBy(() -> service.archive(existing.getId()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đang được dùng");
    }

    @Test
    void updateQuestionRejectsDraftStatusWhenQuestionIsUsedByPublishedPaper() {
        QuestionBankQuestion existing = existingQuestion();
        when(questionRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(examPaperQuestionRepository.countDistinctExamPapersByQuestionAndStatus(existing, ExamPaperStatus.PUBLISHED)).thenReturn(1L);

        assertThatThrownBy(() -> service.update(existing.getId(), validRequest("DRAFT"), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đang được dùng");
    }

    @Test
    void createRejectsStrongDuplicate() {
        when(duplicateCheckService.check(anyString())).thenReturn(new DuplicateCheckResult(
                0.97,
                99L,
                "Câu hỏi đã có",
                true,
                true
        ));

        assertThatThrownBy(() -> service.create(validRequest("APPROVED"), "admin"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("trùng mạnh");
    }

    private UpsertQuestionBankQuestionRequest validRequest(String status) {
        return new UpsertQuestionBankQuestionRequest(
                "Khi xác định người bệnh trước thủ thuật, nhân viên cần làm gì?",
                "Đối chiếu tối thiểu hai thông tin nhận diện.",
                "Chỉ hỏi tên người bệnh.",
                "Dựa vào số giường hiện tại.",
                "Có thể bỏ qua nếu người bệnh tỉnh.",
                "a",
                "Cần dùng tối thiểu hai thông tin nhận diện.",
                "vi",
                "Nhập thủ công",
                status,
                null,
                null,
                CognitiveLevel.FOUNDATION.name(),
                null
        );
    }

    private QuestionBankQuestion existingQuestion() {
        return QuestionBankQuestion.builder()
                .id(5L)
                .stem("Câu hỏi cũ")
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .explanation("Giải thích")
                .language("vi")
                .sourceDocument("Nhập thủ công")
                .questionType(QuestionType.ORIGINAL)
                .cognitiveLevel(CognitiveLevel.FOUNDATION)
                .status(QuestionBankStatus.APPROVED)
                .build();
    }
}
