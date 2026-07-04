package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationProvider;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGeneratorRouter;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentChunkRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentKnowledgePointRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionJobRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DocumentQuestionJobServiceTest {
    private final QuestionDocumentService documentService = mock(QuestionDocumentService.class);
    private final DocumentChunkRepository chunkRepository = mock(DocumentChunkRepository.class);
    private final DocumentQuestionJobRepository jobRepository = mock(DocumentQuestionJobRepository.class);
    private final DocumentKnowledgePointRepository knowledgePointRepository = mock(DocumentKnowledgePointRepository.class);
    private final DocumentQuestionCandidateRepository candidateRepository = mock(DocumentQuestionCandidateRepository.class);
    private final DocumentQuestionGeneratorRouter generatorRouter = mock(DocumentQuestionGeneratorRouter.class);
    private final QuestionCandidateValidationService validationService = mock(QuestionCandidateValidationService.class);
    private final DuplicateCheckService duplicateCheckService = mock(DuplicateCheckService.class);
    private final GenerationKeyService generationKeyService = mock(GenerationKeyService.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private DocumentQuestionJobService service;
    private DocumentQuestionJob job;

    @BeforeEach
    void setUp() {
        service = new DocumentQuestionJobService(
                documentService,
                chunkRepository,
                jobRepository,
                knowledgePointRepository,
                candidateRepository,
                generatorRouter,
                validationService,
                duplicateCheckService,
                generationKeyService,
                new DocumentQuestionMapper(),
                new AiGenerationProperties(),
                new DocumentProcessingProperties(),
                new ObjectMapper(),
                eventPublisher
        );
        QuestionDocument document = QuestionDocument.builder()
                .id(10L)
                .filename("huong-dan.pdf")
                .contentType("application/pdf")
                .status(DocumentStatus.READY)
                .pageCount(1)
                .chunkCount(1)
                .build();
        job = DocumentQuestionJob.builder()
                .id(20L)
                .document(document)
                .provider(GenerationProvider.api)
                .model("deepseek")
                .promptVersion("v1")
                .status(JobStatus.GENERATING)
                .questionsPerChunk(1)
                .chunkCount(1)
                .completedChunkCount(0)
                .failedChunkCount(0)
                .candidateCount(0)
                .chunkErrors("[]")
                .llmCallCount(0)
                .totalPromptTokens(0)
                .totalCompletionTokens(0)
                .totalTokens(0)
                .totalLatencyMs(0L)
                .estimatedCostUsd(0.0)
                .build();

        when(jobRepository.findById(job.getId())).thenReturn(Optional.of(job));
        when(jobRepository.save(any(DocumentQuestionJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(knowledgePointRepository.findByJobOrderByIdAsc(job)).thenReturn(List.of());
        when(candidateRepository.findByJobOrderByIdAsc(job)).thenReturn(List.of());
    }

    @Test
    void cancelMarksLiveJobCancelled() {
        var response = service.cancel(job.getId());

        assertThat(response.status()).isEqualTo(JobStatus.CANCELLED.name());
        assertThat(job.getStatus()).isEqualTo(JobStatus.CANCELLED);
        assertThat(job.getErrorMessage()).contains("hủy");
    }

    @Test
    void failJobDoesNotOverrideCancelledJob() {
        job.setStatus(JobStatus.CANCELLED);
        job.setErrorMessage("Đã hủy");

        service.failJob(job.getId(), "provider failed");

        assertThat(job.getStatus()).isEqualTo(JobStatus.CANCELLED);
        assertThat(job.getErrorMessage()).isEqualTo("Đã hủy");
    }
}
