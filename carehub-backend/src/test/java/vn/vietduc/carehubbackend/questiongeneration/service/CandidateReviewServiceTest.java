package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.BatchDocumentQuestionCandidateActionRequest;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionClassificationTestResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentChunkType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationProvider;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CandidateReviewServiceTest {
    private final DocumentQuestionCandidateRepository candidateRepository = mock(DocumentQuestionCandidateRepository.class);
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final QuestionCandidateValidationService validationService = mock(QuestionCandidateValidationService.class);
    private final DuplicateCheckService duplicateCheckService = mock(DuplicateCheckService.class);
    private final QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
    private final QuestionClassificationRuleService classificationRuleService = mock(QuestionClassificationRuleService.class);
    private final AtomicLong questionIds = new AtomicLong(300);
    private CandidateReviewService service;

    @BeforeEach
    void setUp() {
        service = new CandidateReviewService(
                candidateRepository,
                questionRepository,
                validationService,
                duplicateCheckService,
                embeddingService,
                new DocumentQuestionMapper(),
                new ObjectMapper(),
                classificationRuleService
        );
        when(questionRepository.save(any(QuestionBankQuestion.class))).thenAnswer(invocation -> {
            QuestionBankQuestion question = invocation.getArgument(0);
            question.setId(questionIds.incrementAndGet());
            return question;
        });
        when(candidateRepository.save(any(DocumentQuestionCandidate.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(duplicateCheckService.check(any(), anySet(), anySet()))
                .thenReturn(new DuplicateCheckResult(0.12, null, null, false, false));
        when(classificationRuleService.classifyQuestion(any(), any(), any(), any(), any()))
                .thenReturn(new QuestionClassificationTestResponse(null, null, null, "Chưa phân loại", 0, "Không khớp"));
    }

    @Test
    void saveAsQuestionCreatesQuestionAndEmbeddingForApprovedCandidate() {
        DocumentQuestionCandidate candidate = approvedCandidate();
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        var response = service.saveAsQuestion(candidate.getId(), "admin");

        assertThat(response.status()).isEqualTo(CandidateStatus.SAVED.name());
        assertThat(response.savedQuestionId()).isNotNull();
        verify(questionRepository).save(any(QuestionBankQuestion.class));
        verify(embeddingService).saveStemEmbedding(any(QuestionBankQuestion.class));
        verify(duplicateCheckService).check(eq(candidate.getStem()), eq(Set.of()), eq(Set.of(candidate.getId())));
    }

    @Test
    void saveAsQuestionRejectsUnapprovedCandidate() {
        DocumentQuestionCandidate candidate = approvedCandidate();
        candidate.setStatus(CandidateStatus.NEED_REVIEW);
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> service.saveAsQuestion(candidate.getId(), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("đã được duyệt");
    }

    @Test
    void saveAsQuestionRejectsMissingSourceExcerpt() {
        DocumentQuestionCandidate candidate = approvedCandidate();
        candidate.setSourceExcerpt(" ");
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> service.saveAsQuestion(candidate.getId(), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("trích dẫn nguồn");
    }

    @Test
    void saveAsQuestionRejectsGenericDocumentReferenceStem() {
        DocumentQuestionCandidate candidate = approvedCandidate();
        candidate.setStem("Theo tài liệu, nhận định nào phù hợp nhất với nội dung trong mục \"An toàn người bệnh\"?");
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        assertThatThrownBy(() -> service.saveAsQuestion(candidate.getId(), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("tự đứng độc lập");
    }

    @Test
    void saveAsQuestionRejectsStrongDuplicateAtSaveTime() {
        DocumentQuestionCandidate candidate = approvedCandidate();
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));
        when(duplicateCheckService.check(any(), anySet(), anySet()))
                .thenReturn(new DuplicateCheckResult(0.96, 22L, "Câu hỏi đã có", true, true));

        assertThatThrownBy(() -> service.saveAsQuestion(candidate.getId(), "admin"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("trùng mạnh");
    }

    @Test
    void approveBatchUpdatesValidCandidatesAndReportsMissingOnes() {
        DocumentQuestionCandidate first = approvedCandidate();
        first.setStatus(CandidateStatus.NEED_REVIEW);
        first.setLabel(CandidateLabel.NEED_REVIEW);
        DocumentQuestionCandidate second = approvedCandidate();
        second.setId(41L);
        second.setStatus(CandidateStatus.VALIDATED);
        when(candidateRepository.findById(first.getId())).thenReturn(Optional.of(first));
        when(candidateRepository.findById(second.getId())).thenReturn(Optional.of(second));
        when(candidateRepository.findById(999L)).thenReturn(Optional.empty());

        var response = service.approveBatch(new BatchDocumentQuestionCandidateActionRequest(
                java.util.List.of(first.getId(), second.getId(), 999L),
                "Đạt yêu cầu"
        ));

        assertThat(response.requestedCount()).isEqualTo(3);
        assertThat(response.succeededCount()).isEqualTo(2);
        assertThat(response.failedCount()).isEqualTo(1);
        assertThat(response.candidates()).hasSize(2);
        assertThat(first.getStatus()).isEqualTo(CandidateStatus.APPROVED);
        assertThat(second.getStatus()).isEqualTo(CandidateStatus.APPROVED);
        assertThat(first.getReviewerNotes()).isEqualTo("Đạt yêu cầu");
    }

    @Test
    void rejectBatchDeduplicatesIds() {
        DocumentQuestionCandidate candidate = approvedCandidate();
        when(candidateRepository.findById(candidate.getId())).thenReturn(Optional.of(candidate));

        var response = service.rejectBatch(new BatchDocumentQuestionCandidateActionRequest(
                java.util.List.of(candidate.getId(), candidate.getId()),
                "Không phù hợp"
        ));

        assertThat(response.requestedCount()).isEqualTo(1);
        assertThat(response.succeededCount()).isEqualTo(1);
        assertThat(candidate.getStatus()).isEqualTo(CandidateStatus.REJECTED);
        assertThat(candidate.getLabel()).isEqualTo(CandidateLabel.REJECTED);
        assertThat(candidate.getReviewerNotes()).isEqualTo("Không phù hợp");
    }

    private DocumentQuestionCandidate approvedCandidate() {
        QuestionDocument document = QuestionDocument.builder()
                .id(10L)
                .filename("huong-dan.pdf")
                .contentType("application/pdf")
                .status(DocumentStatus.READY)
                .pageCount(1)
                .chunkCount(1)
                .build();
        DocumentChunk chunk = DocumentChunk.builder()
                .id(20L)
                .document(document)
                .chunkIndex(0)
                .chunkType(DocumentChunkType.generation)
                .text("Người bệnh cần được xác định bằng tối thiểu hai thông tin trước khi thực hiện chăm sóc.")
                .textHash("hash")
                .charCount(96)
                .tokenCount(14)
                .qualityFlags("[]")
                .build();
        DocumentQuestionJob job = DocumentQuestionJob.builder()
                .id(30L)
                .document(document)
                .provider(GenerationProvider.api)
                .status(JobStatus.GENERATED)
                .questionsPerChunk(1)
                .chunkCount(1)
                .completedChunkCount(1)
                .failedChunkCount(0)
                .candidateCount(1)
                .chunkErrors("[]")
                .llmCallCount(1)
                .totalPromptTokens(1)
                .totalCompletionTokens(1)
                .totalTokens(2)
                .totalLatencyMs(100L)
                .estimatedCostUsd(0.0)
                .build();
        return DocumentQuestionCandidate.builder()
                .id(40L)
                .job(job)
                .document(document)
                .chunk(chunk)
                .stem("Yêu cầu nào đúng khi xác định người bệnh trước khi chăm sóc?")
                .optionA("Xác định bằng tối thiểu hai thông tin.")
                .optionB("Chỉ hỏi tên người bệnh.")
                .optionC("Có thể bỏ qua khi bận.")
                .optionD("Chỉ cần nhìn số giường.")
                .correctAnswer("A")
                .explanation("Đáp án A bám nguồn.")
                .topic("An toàn người bệnh")
                .difficulty("easy")
                .sourceExcerpt("Người bệnh cần được xác định bằng tối thiểu hai thông tin")
                .rawJson("{}")
                .qualityScore(0.9)
                .label(CandidateLabel.GOOD)
                .warnings("[]")
                .status(CandidateStatus.APPROVED)
                .build();
    }
}
