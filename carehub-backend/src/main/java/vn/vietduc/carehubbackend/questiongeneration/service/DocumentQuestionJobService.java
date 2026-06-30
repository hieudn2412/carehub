package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateDocumentQuestionJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationProvider;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGenerator;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGeneratorRouter;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentChunkRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentKnowledgePointRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.CandidateValidationResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DocumentQuestionJobService {
    private static final List<CandidateStatus> IDEMPOTENT_STATUSES = List.of(
            CandidateStatus.VALIDATED,
            CandidateStatus.NEED_REVIEW,
            CandidateStatus.APPROVED,
            CandidateStatus.REJECTED,
            CandidateStatus.SAVED
    );

    private final QuestionDocumentService documentService;
    private final DocumentChunkRepository chunkRepository;
    private final DocumentQuestionJobRepository jobRepository;
    private final DocumentKnowledgePointRepository knowledgePointRepository;
    private final DocumentQuestionCandidateRepository candidateRepository;
    private final DocumentQuestionGeneratorRouter generatorRouter;
    private final QuestionCandidateValidationService validationService;
    private final DuplicateCheckService duplicateCheckService;
    private final GenerationKeyService generationKeyService;
    private final DocumentQuestionMapper mapper;
    private final AiGenerationProperties generationProperties;
    private final DocumentProcessingProperties documentProperties;
    private final ObjectMapper objectMapper;

    @Transactional
    public DocumentQuestionJobResponse createJob(Long documentId, CreateDocumentQuestionJobRequest request, String actor) {
        QuestionDocument document = documentService.findDocument(documentId);
        if (document.getStatus() == DocumentStatus.OCR_REQUIRED) {
            throw new BadRequestException("Tài liệu cần OCR trước khi tạo câu hỏi");
        }
        if (document.getStatus() != DocumentStatus.READY) {
            throw new BadRequestException("Tài liệu chưa sẵn sàng để tạo câu hỏi");
        }
        List<DocumentChunk> chunks = chunkRepository.findByDocumentOrderByChunkIndexAsc(document);
        if (chunks.isEmpty()) {
            throw new BadRequestException("Tài liệu chưa có chunk để tạo câu hỏi");
        }

        int questionsPerChunk = request != null && request.questionsPerChunk() != null
                ? request.questionsPerChunk()
                : documentProperties.getQuestionsPerChunk();
        DocumentQuestionJob job = DocumentQuestionJob.builder()
                .document(document)
                .provider(providerEnum())
                .model(generationProperties.getModel())
                .promptVersion(generationProperties.getPromptVersion())
                .status(JobStatus.GENERATING)
                .questionsPerChunk(questionsPerChunk)
                .chunkCount(chunks.size())
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
                .createdBy(actor)
                .build();
        DocumentQuestionJob savedJob = jobRepository.save(job);
        ProcessResult result = processChunks(savedJob, chunks);
        applyResult(savedJob, result, true);
        return get(savedJob.getId());
    }

    @Transactional(readOnly = true)
    public DocumentQuestionJobResponse get(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        return mapper.toJobResponse(
                job,
                knowledgePointRepository.findByJobOrderByIdAsc(job),
                candidateRepository.findByJobOrderByIdAsc(job)
        );
    }

    @Transactional
    public DocumentQuestionJobResponse retryFailedChunks(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        List<Long> chunkIds = failedChunkIds(job.getChunkErrors());
        if (chunkIds.isEmpty()) {
            return get(jobId);
        }
        List<DocumentChunk> chunks = chunkRepository.findAllById(chunkIds).stream()
                .sorted(Comparator.comparing(DocumentChunk::getChunkIndex))
                .toList();
        job.setStatus(JobStatus.GENERATING);
        job.setFailedChunkCount(0);
        job.setChunkErrors("[]");
        ProcessResult result = processChunks(job, chunks);
        applyResult(job, result, false);
        return get(jobId);
    }

    private ProcessResult processChunks(DocumentQuestionJob job, List<DocumentChunk> chunks) {
        DocumentQuestionGenerator generator = generatorRouter.current();
        ProcessResult result = new ProcessResult();
        for (DocumentChunk chunk : chunks) {
            try {
                String firstKey = generationKeyService.candidateKey(
                        generator.provider(),
                        generationProperties.getModel(),
                        generationProperties.getPromptVersion(),
                        job.getQuestionsPerChunk(),
                        chunk.getTextHash(),
                        "vi",
                        0
                );
                if (candidateRepository.findFirstByGenerationKeyAndStatusIn(firstKey, IDEMPOTENT_STATUSES).isPresent()) {
                    result.completedChunks++;
                    continue;
                }
                GeneratedChunkResult generated = generator.generate(new GenerationInput(
                        job.getDocument().getId(),
                        job.getId(),
                        chunk.getId(),
                        chunk.getText(),
                        chunk.getSectionPath(),
                        job.getQuestionsPerChunk(),
                        "vi"
                ));
                result.usage = result.usage.plus(generated.usage());
                persistKnowledgePoints(job, chunk, generated.knowledgePoints());
                result.createdCandidates += persistCandidates(job, chunk, generated.questions(), generator.provider());
                result.completedChunks++;
            } catch (Exception ex) {
                result.failedChunks++;
                result.errors.add(Map.of(
                        "chunkId", chunk.getId(),
                        "chunkIndex", chunk.getChunkIndex(),
                        "message", ex.getMessage() == null ? "Lỗi không xác định" : ex.getMessage()
                ));
            }
        }
        return result;
    }

    private void persistKnowledgePoints(
            DocumentQuestionJob job,
            DocumentChunk chunk,
            List<GeneratedKnowledgePoint> knowledgePoints
    ) {
        for (GeneratedKnowledgePoint point : knowledgePoints) {
            DocumentKnowledgePoint entity = DocumentKnowledgePoint.builder()
                    .job(job)
                    .document(job.getDocument())
                    .chunk(chunk)
                    .sourceKey(point.id())
                    .statement(blankToFallback(point.statement(), "Knowledge point"))
                    .knowledgeType(point.type())
                    .importance(point.importance())
                    .sourceExcerpt(point.sourceExcerpt())
                    .generationEligible(point.generationEligible())
                    .rawJson(blankToFallback(point.rawJson(), "{}"))
                    .build();
            knowledgePointRepository.save(entity);
        }
    }

    private int persistCandidates(
            DocumentQuestionJob job,
            DocumentChunk chunk,
            List<GeneratedQuestion> questions,
            String provider
    ) {
        int created = 0;
        for (int i = 0; i < questions.size(); i++) {
            GeneratedQuestion question = questions.get(i);
            String generationKey = generationKeyService.candidateKey(
                    provider,
                    generationProperties.getModel(),
                    generationProperties.getPromptVersion(),
                    job.getQuestionsPerChunk(),
                    chunk.getTextHash(),
                    "vi",
                    i
            );
            if (candidateRepository.findFirstByGenerationKeyAndStatusIn(generationKey, IDEMPOTENT_STATUSES).isPresent()) {
                continue;
            }
            CandidateValidationResult validation = validationService.validate(question, chunk.getText());
            DuplicateCheckResult duplicate = duplicateCheckService.check(question.stem());
            List<String> warnings = new ArrayList<>(validation.warnings());
            CandidateStatus status;
            CandidateLabel label;
            if (validation.rejected()) {
                status = CandidateStatus.REJECTED;
                label = CandidateLabel.REJECTED;
            } else if (duplicate.strongDuplicate()) {
                status = CandidateStatus.REJECTED;
                label = CandidateLabel.REJECTED;
                warnings.add("Trùng ngữ nghĩa mạnh với câu hỏi đã có");
            } else if (validation.needsReview() || duplicate.needsReview()) {
                status = CandidateStatus.NEED_REVIEW;
                label = CandidateLabel.NEED_REVIEW;
                if (duplicate.needsReview()) {
                    warnings.add("Có khả năng trùng ngữ nghĩa với câu hỏi đã có");
                }
            } else {
                status = CandidateStatus.VALIDATED;
                label = CandidateLabel.GOOD;
            }
            DocumentQuestionCandidate candidate = DocumentQuestionCandidate.builder()
                    .job(job)
                    .document(job.getDocument())
                    .chunk(chunk)
                    .stem(blankToFallback(question.stem(), "Câu hỏi chưa có nội dung"))
                    .optionA(blankToFallback(question.optionA(), ""))
                    .optionB(blankToFallback(question.optionB(), ""))
                    .optionC(blankToFallback(question.optionC(), ""))
                    .optionD(blankToFallback(question.optionD(), ""))
                    .correctAnswer(normalizeAnswer(question.correctAnswer()))
                    .explanation(question.explanation())
                    .topic(question.topic())
                    .difficulty(question.difficulty())
                    .sourceExcerpt(question.sourceExcerpt())
                    .knowledgePointKey(question.knowledgePointId())
                    .generationKey(generationKey)
                    .rawJson(blankToFallback(question.rawJson(), "{}"))
                    .qualityScore(validation.qualityScore())
                    .llmValidation(question.llmValidationJson())
                    .label(label)
                    .warnings(toJson(warnings))
                    .status(status)
                    .duplicateMaxSimilarity(duplicate.maxSimilarity())
                    .duplicateQuestionId(duplicate.matchedQuestionId())
                    .duplicateQuestionStemSnapshot(duplicate.matchedQuestionStem())
                    .build();
            candidateRepository.save(candidate);
            created++;
        }
        return created;
    }

    private void applyResult(DocumentQuestionJob job, ProcessResult result, boolean resetCounts) {
        job.setCompletedChunkCount((resetCounts ? 0 : job.getCompletedChunkCount()) + result.completedChunks);
        job.setFailedChunkCount(result.failedChunks);
        job.setCandidateCount((resetCounts ? 0 : job.getCandidateCount()) + result.createdCandidates);
        job.setChunkErrors(toJson(result.errors));
        job.setLlmCallCount(job.getLlmCallCount() + result.usage.callCount());
        job.setTotalPromptTokens(job.getTotalPromptTokens() + result.usage.promptTokens());
        job.setTotalCompletionTokens(job.getTotalCompletionTokens() + result.usage.completionTokens());
        job.setTotalTokens(job.getTotalTokens() + result.usage.totalTokens());
        job.setTotalLatencyMs(job.getTotalLatencyMs() + result.usage.latencyMs());
        if (result.failedChunks == 0) {
            job.setStatus(JobStatus.GENERATED);
            job.setErrorMessage(null);
        } else if (result.completedChunks > 0 || job.getCandidateCount() > 0) {
            job.setStatus(JobStatus.PARTIALLY_COMPLETED);
            job.setErrorMessage("Một số chunk xử lý lỗi, có thể retry riêng");
        } else {
            job.setStatus(JobStatus.FAILED);
            job.setErrorMessage("Không xử lý thành công chunk nào");
        }
        jobRepository.save(job);
    }

    private DocumentQuestionJob findJob(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiên tạo câu hỏi"));
    }

    private GenerationProvider providerEnum() {
        try {
            return GenerationProvider.valueOf(generationProperties.getProvider().toLowerCase());
        } catch (Exception ex) {
            throw new BadRequestException("Provider tạo câu hỏi chưa được hỗ trợ: " + generationProperties.getProvider());
        }
    }

    private List<Long> failedChunkIds(String chunkErrors) {
        try {
            JsonNode root = objectMapper.readTree(chunkErrors == null || chunkErrors.isBlank() ? "[]" : chunkErrors);
            List<Long> ids = new ArrayList<>();
            if (root.isArray()) {
                root.forEach(item -> {
                    if (item.has("chunkId")) {
                        ids.add(item.path("chunkId").asLong());
                    }
                });
            }
            return ids;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String normalizeAnswer(String answer) {
        if (answer == null || !answer.trim().toUpperCase().matches("[ABCD]")) {
            return "A";
        }
        return answer.trim().toUpperCase();
    }

    private String blankToFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[]";
        }
    }

    private static class ProcessResult {
        private int completedChunks;
        private int failedChunks;
        private int createdCandidates;
        private LlmUsage usage = LlmUsage.empty();
        private final List<Map<String, Object>> errors = new ArrayList<>();
    }
}
