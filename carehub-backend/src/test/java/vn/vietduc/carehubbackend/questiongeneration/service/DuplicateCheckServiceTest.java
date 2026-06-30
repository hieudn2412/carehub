package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.ValidationRulesProperties;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DuplicateCheckServiceTest {
    private final DocumentQuestionCandidateRepository candidateRepository = mock(DocumentQuestionCandidateRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
    private final ValidationRulesProperties validationProperties = new ValidationRulesProperties();
    private DuplicateCheckService service;

    @BeforeEach
    void setUp() {
        embeddingProperties.setProvider("e5");
        service = new DuplicateCheckService(
                candidateRepository,
                questionRepository,
                embeddingService,
                embeddingProperties,
                validationProperties
        );
        when(candidateRepository.findTop100ByStatusIn(org.mockito.ArgumentMatchers.<Collection<CandidateStatus>>any()))
                .thenReturn(List.of());
    }

    @Test
    void semanticCheckMarksStrongDuplicateAndHonorsExcludedSourceQuestion() {
        when(embeddingService.embedCandidateStem("Cần xác định người bệnh bằng mấy thông tin?"))
                .thenReturn(new double[]{1.0, 0.0});
        when(embeddingService.approvedStemEmbeddings()).thenReturn(List.of(
                new QuestionEmbeddingSnapshot(10L, "Nguồn gốc cần bỏ qua", new double[]{1.0, 0.0}),
                new QuestionEmbeddingSnapshot(11L, "Đối chiếu hai thông tin nhận diện người bệnh", new double[]{0.96, 0.28})
        ));

        DuplicateCheckResult result = service.check(
                "Cần xác định người bệnh bằng mấy thông tin?",
                Set.of(10L)
        );

        assertThat(result.checker()).isEqualTo("e5");
        assertThat(result.matchedQuestionId()).isEqualTo(11L);
        assertThat(result.maxSimilarity()).isGreaterThanOrEqualTo(validationProperties.getDuplicate().getStrongMin());
        assertThat(result.strongDuplicate()).isTrue();
        assertThat(result.needsReview()).isTrue();
        assertThat(result.warning()).isNull();
    }

    @Test
    void semanticFailureFallsBackToLexicalCheckWithWarning() {
        when(embeddingService.embedCandidateStem(anyString())).thenThrow(new IllegalStateException("model missing"));
        when(questionRepository.findTop100ByStatus(QuestionBankStatus.APPROVED)).thenReturn(List.of(
                approvedQuestion(20L, "Cần xác định người bệnh bằng hai thông tin nhận diện")
        ));

        DuplicateCheckResult result = service.check("Cần xác định người bệnh bằng hai thông tin nhận diện");

        assertThat(result.checker()).isEqualTo("lexical-fallback");
        assertThat(result.warning()).contains("kiểm tra trùng ngữ nghĩa");
        assertThat(result.matchedQuestionId()).isEqualTo(20L);
        assertThat(result.maxSimilarity()).isEqualTo(1.0);
        assertThat(result.strongDuplicate()).isTrue();
    }

    private QuestionBankQuestion approvedQuestion(Long id, String stem) {
        return QuestionBankQuestion.builder()
                .id(id)
                .stem(stem)
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer("A")
                .language("vi")
                .status(QuestionBankStatus.APPROVED)
                .build();
    }
}
