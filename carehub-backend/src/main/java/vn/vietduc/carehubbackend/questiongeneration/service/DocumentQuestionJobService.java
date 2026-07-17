package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
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
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
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
    private final QuestionCategoryRepository questionCategoryRepository;
    private final DocumentQuestionMapper mapper;
    private final AiGenerationProperties generationProperties;
    private final DocumentProcessingProperties documentProperties;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    // Self-injection for @Transactional(REQUIRES_NEW) per chunk
    private DocumentQuestionJobService self;

    @org.springframework.context.annotation.Lazy
    @org.springframework.beans.factory.annotation.Autowired
    public void setSelf(DocumentQuestionJobService self) {
        this.self = self;
    }

    // Cancellation cache (TTL 5s)
    private final Map<Long, CachedCancellation> cancellationCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 5_000;

    private record CachedCancellation(boolean cancelled, long timestamp) {
    }

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
        long eligibleChunkCount = chunks.stream()
                .filter(chunk -> DocumentChunkQualityRules.isGenerationEligible(parseQualityFlags(chunk.getQualityFlags())))
                .count();
        if (eligibleChunkCount == 0) {
            throw new BadRequestException("Tài liệu không có chunk đủ điều kiện để tạo câu hỏi");
        }

        int questionsPerChunk = request != null && request.questionsPerChunk() != null
                ? request.questionsPerChunk()
                : documentProperties.getQuestionsPerChunk();
        QuestionCategory category = null;
        if (request != null && request.categoryId() != null) {
            category = questionCategoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy danh mục câu hỏi"));
        }
        String traceId = java.util.UUID.randomUUID().toString().substring(0, 8);
        DocumentQuestionJob job = DocumentQuestionJob.builder()
                .document(document)
                .category(category)
                .provider(providerEnum())
                .model(generationProperties.getModel())
                .promptVersion(generationProperties.getPromptVersion())
                .status(JobStatus.CREATED)
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
                .traceId(traceId)
                .createdBy(actor)
                .build();
        DocumentQuestionJob savedJob = jobRepository.save(job);
        eventPublisher.publishEvent(new DocumentQuestionJobCreatedEvent(savedJob.getId()));
        return get(savedJob.getId());
    }

    @Transactional
    public void processJob(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        if (job.getStatus() == JobStatus.CANCELLED) {
            log.info("Skip cancelled document question job jobId={}", jobId);
            return;
        }
        if (job.getStatus() != JobStatus.CREATED) {
            log.info("Skip document question job processing jobId={} status={}", jobId, job.getStatus());
            return;
        }
        List<DocumentChunk> chunks = chunkRepository.findByDocumentOrderByChunkIndexAsc(job.getDocument());
        job.setStatus(JobStatus.GENERATING);
        job.setCompletedChunkCount(0);
        job.setFailedChunkCount(0);
        job.setCandidateCount(0);
        job.setChunkErrors("[]");
        job.setErrorMessage(null);
        jobRepository.save(job);

        ProcessResult result = processChunks(job, chunks);
        applyResult(job, result, true);
    }

    @Transactional
    public void failJob(Long jobId, String message) {
        DocumentQuestionJob job = findJob(jobId);
        if (job.getStatus() == JobStatus.CANCELLED) {
            return;
        }
        job.setStatus(JobStatus.FAILED);
        job.setErrorMessage(blankToFallback(message, "Lỗi khi xử lý phiên tạo câu hỏi"));
        jobRepository.save(job);
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

    @Transactional(readOnly = true)
    public List<DocumentQuestionJobResponse> listByDocument(Long documentId) {
        QuestionDocument document = documentService.findDocument(documentId);
        return jobRepository.findByDocumentOrderByCreatedAtDesc(document).stream()
                .map(job -> mapper.toJobResponse(job, List.of(), List.of()))
                .toList();
    }

    @Transactional
    public DocumentQuestionJobResponse retryFailedChunks(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        if (job.getStatus() == JobStatus.CANCELLED) {
            throw new BadRequestException("Không thể retry phiên tạo câu hỏi đã hủy");
        }
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

    @Transactional
    public DocumentQuestionJobResponse cancel(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        if (!List.of(JobStatus.CREATED, JobStatus.GENERATING).contains(job.getStatus())) {
            throw new BadRequestException("Chỉ có thể hủy phiên đang chờ hoặc đang tạo câu hỏi");
        }
        job.setStatus(JobStatus.CANCELLED);
        job.setErrorMessage("Phiên tạo câu hỏi đã được hủy bởi người dùng");
        cancellationCache.put(jobId, new CachedCancellation(true, System.currentTimeMillis()));
        return mapper.toJobResponse(
                jobRepository.save(job),
                knowledgePointRepository.findByJobOrderByIdAsc(job),
                candidateRepository.findByJobOrderByIdAsc(job)
        );
    }

    private ProcessResult processChunks(DocumentQuestionJob job, List<DocumentChunk> chunks) {
        DocumentQuestionGenerator generator = generatorRouter.current();
        ProcessResult result = new ProcessResult();

        int parallelism = resolveParallelism();
        if (!generationProperties.isParallelChunkProcessing() || parallelism <= 1) {
            return processChunksSequential(job, chunks, generator, result);
        }
        return processChunksParallel(job, chunks, generator, result, parallelism);
    }

    private ProcessResult processChunksSequential(DocumentQuestionJob job, List<DocumentChunk> chunks,
                                                   DocumentQuestionGenerator generator, ProcessResult result) {
        for (DocumentChunk chunk : chunks) {
            if (isCancellationRequested(job.getId())) {
                result.cancelled = true;
                break;
            }
            ChunkOutcome outcome = executeSingleChunk(job, chunk, generator);
            mergeOutcome(result, outcome);
            if (outcome.cancelled) {
                break;
            }
        }
        return result;
    }

    private ProcessResult processChunksParallel(DocumentQuestionJob job, List<DocumentChunk> chunks,
                                                 DocumentQuestionGenerator generator, ProcessResult result,
                                                 int parallelism) {
        ExecutorService chunkExecutor = Executors.newFixedThreadPool(parallelism);
        List<Future<ChunkOutcome>> futures = new ArrayList<>();

        for (DocumentChunk chunk : chunks) {
            futures.add(chunkExecutor.submit(() -> {
                if (isCancellationRequested(job.getId())) {
                    return ChunkOutcome.cancelledOutcome();
                }
                return self.processSingleChunkTransactional(job, chunk, generator);
            }));
        }

        for (Future<ChunkOutcome> future : futures) {
            try {
                ChunkOutcome outcome = future.get();
                if (outcome.cancelled) {
                    result.cancelled = true;
                    break;
                }
                mergeOutcome(result, outcome);
            } catch (ExecutionException ex) {
                result.failedChunks++;
                log.warn("Chunk processing failed in parallel", ex.getCause());
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                result.cancelled = true;
                break;
            }
        }
        chunkExecutor.shutdownNow();
        try {
            chunkExecutor.awaitTermination(30, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return result;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ChunkOutcome processSingleChunkTransactional(DocumentQuestionJob job, DocumentChunk chunk,
                                                          DocumentQuestionGenerator generator) {
        return executeSingleChunk(job, chunk, generator);
    }

    private ChunkOutcome executeSingleChunk(DocumentQuestionJob job, DocumentChunk chunk,
                                             DocumentQuestionGenerator generator) {
        long chunkStarted = System.nanoTime();
        long generatorMs = 0;
        CandidatePersistResult persistResult = CandidatePersistResult.empty();
        try {
            List<String> qualityFlags = parseQualityFlags(chunk.getQualityFlags());
            if (!DocumentChunkQualityRules.isGenerationEligible(qualityFlags)) {
                logChunkTiming(job, chunk, 0, 0, 0, 0, 0, "skipped_quality");
                return ChunkOutcome.completedOutcome(0, LlmUsage.empty());
            }
            String firstKey = generationKeyService.candidateKey(
                    generator.provider(),
                    generationProperties.getModel(),
                    generationProperties.getPromptVersion(),
                    job.getQuestionsPerChunk(),
                    chunk.getTextHash(),
                    "vi",
                    0
            );
            long duplicateCheckStarted = System.nanoTime();
            if (candidateRepository.findFirstByGenerationKeyAndStatusIn(firstKey, IDEMPOTENT_STATUSES).isPresent()) {
                long duplicateCheckMs = elapsedMs(duplicateCheckStarted);
                logChunkTiming(job, chunk, 0, 0, duplicateCheckMs, 0, 0, "skipped_existing");
                log.info("Idempotency skip: chunkId={} key={} provider={} model={} promptVersion={}",
                        chunk.getId(), firstKey.substring(0, 8),
                        generator.provider(), generationProperties.getModel(),
                        generationProperties.getPromptVersion());
                return ChunkOutcome.completedOutcome(0, LlmUsage.empty());
            }
            long generatorStarted = System.nanoTime();
            GeneratedChunkResult generated = generator.generate(new GenerationInput(
                    job.getDocument().getId(),
                    job.getId(),
                    chunk.getId(),
                    chunk.getText(),
                    chunk.getSectionPath(),
                    job.getQuestionsPerChunk(),
                    "vi"
            ));
            generatorMs = elapsedMs(generatorStarted);
            long persistKnowledgeStarted = System.nanoTime();
            persistKnowledgePoints(job, chunk, generated.knowledgePoints());
            long persistKnowledgeMs = elapsedMs(persistKnowledgeStarted);
            persistResult = persistCandidates(job, chunk, generated.questions(), generator.provider());
            logChunkTiming(
                    job,
                    chunk,
                    generatorMs,
                    persistKnowledgeMs + persistResult.persistCandidateMs(),
                    persistResult.duplicateCheckMs(),
                    persistResult.createdCount(),
                    generated.usage().callCount(),
                    "completed"
            );
            return ChunkOutcome.completedOutcome(persistResult.createdCount(), generated.usage());
        } catch (Exception ex) {
            log.warn(
                    "Document question chunk failed jobId={} chunkId={} chunkIndex={} tokenCount={} generatorMs={} persistCandidateMs={} duplicateCheckMs={} totalMs={} message={}",
                    job.getId(),
                    chunk.getId(),
                    chunk.getChunkIndex(),
                    chunk.getTokenCount(),
                    generatorMs,
                    persistResult.persistCandidateMs(),
                    persistResult.duplicateCheckMs(),
                    elapsedMs(chunkStarted),
                    ex.getMessage()
            );
            return ChunkOutcome.failedOutcome(chunk.getId(), chunk.getChunkIndex(), ex.getMessage());
        }
    }

    private void mergeOutcome(ProcessResult result, ChunkOutcome outcome) {
        if (outcome.failed) {
            result.failedChunks++;
            result.errors.add(outcome.toErrorMap());
        } else {
            result.completedChunks++;
            result.createdCandidates += outcome.createdCandidates;
            result.usage = result.usage.plus(outcome.usage);
        }
    }

    private int resolveParallelism() {
        if (generationProperties.getChunkParallelism() > 0) {
            return Math.min(generationProperties.getChunkParallelism(), generationProperties.getMaxConcurrentCalls());
        }
        return Math.max(1, generationProperties.getMaxConcurrentCalls());
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

    private CandidatePersistResult persistCandidates(
            DocumentQuestionJob job,
            DocumentChunk chunk,
            List<GeneratedQuestion> questions,
            String provider
    ) {
        int created = 0;
        long duplicateCheckMs = 0;
        long persistCandidateMs = 0;
        String categoryTopic = job.getCategory() != null ? job.getCategory().getName() : null;
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
            long duplicateStarted = System.nanoTime();
            if (candidateRepository.findFirstByGenerationKeyAndStatusIn(generationKey, IDEMPOTENT_STATUSES).isPresent()) {
                duplicateCheckMs += elapsedMs(duplicateStarted);
                continue;
            }
            CandidateValidationResult validation = validationService.validate(question, chunk.getText());
            DuplicateCheckResult duplicate = duplicateCheckService.check(question.stem());
            duplicateCheckMs += elapsedMs(duplicateStarted);
            List<String> warnings = new ArrayList<>(validation.warnings());
            if (duplicate.warning() != null && !duplicate.warning().isBlank()) {
                warnings.add(duplicate.warning());
            }
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
                    .topic(categoryTopic != null ? categoryTopic : question.topic())
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
            long persistStarted = System.nanoTime();
            candidateRepository.save(candidate);
            persistCandidateMs += elapsedMs(persistStarted);
            created++;
        }
        return new CandidatePersistResult(created, duplicateCheckMs, persistCandidateMs);
    }

    private void applyResult(DocumentQuestionJob job, ProcessResult result, boolean resetCounts) {
        if (result.cancelled || isCancellationRequested(job.getId())) {
            job.setStatus(JobStatus.CANCELLED);
            job.setErrorMessage("Phiên tạo câu hỏi đã được hủy bởi người dùng");
            jobRepository.save(job);
            return;
        }
        job.setCompletedChunkCount((resetCounts ? 0 : job.getCompletedChunkCount()) + result.completedChunks);
        job.setFailedChunkCount(result.failedChunks);
        job.setCandidateCount((resetCounts ? 0 : job.getCandidateCount()) + result.createdCandidates);
        job.setChunkErrors(toJson(result.errors));
        job.setLlmCallCount(job.getLlmCallCount() + result.usage.callCount());
        job.setTotalPromptTokens(job.getTotalPromptTokens() + result.usage.promptTokens());
        job.setTotalCompletionTokens(job.getTotalCompletionTokens() + result.usage.completionTokens());
        job.setTotalTokens(job.getTotalTokens() + result.usage.totalTokens());
        job.setTotalLatencyMs(job.getTotalLatencyMs() + result.usage.latencyMs());
        double newCost = estimateCost(job.getModel(), result.usage.promptTokens(), result.usage.completionTokens());
        job.setEstimatedCostUsd(job.getEstimatedCostUsd() + newCost);
        if (result.failedChunks == 0) {
            if (job.getCandidateCount() == 0 && job.getLlmCallCount() == 0 && result.completedChunks > 0) {
                job.setStatus(JobStatus.PARTIALLY_COMPLETED);
                job.setErrorMessage("Tất cả chunk đã được xử lý từ lần trước, không có câu hỏi mới. Hãy cập nhật cấu hình hoặc dùng tài liệu mới.");
            } else {
                job.setStatus(JobStatus.GENERATED);
                job.setErrorMessage(null);
            }
        } else if (result.completedChunks > 0 || job.getCandidateCount() > 0) {
            job.setStatus(JobStatus.PARTIALLY_COMPLETED);
            job.setErrorMessage("Một số chunk xử lý lỗi, có thể retry riêng");
        } else {
            job.setStatus(JobStatus.FAILED);
            job.setErrorMessage("Không xử lý thành công chunk nào");
        }
        jobRepository.save(job);
    }

    private boolean isCancellationRequested(Long jobId) {
        CachedCancellation cached = cancellationCache.get(jobId);
        long now = System.currentTimeMillis();
        if (cached != null && (now - cached.timestamp) < CACHE_TTL_MS) {
            return cached.cancelled;
        }
        boolean cancelled = jobRepository.findStatusByIdOrNull(jobId) == JobStatus.CANCELLED;
        cancellationCache.put(jobId, new CachedCancellation(cancelled, now));
        return cancelled;
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

    private List<String> parseQualityFlags(String qualityFlags) {
        try {
            JsonNode root = objectMapper.readTree(qualityFlags == null || qualityFlags.isBlank() ? "[]" : qualityFlags);
            List<String> flags = new ArrayList<>();
            if (root.isArray()) {
                root.forEach(item -> {
                    if (item.isTextual()) {
                        flags.add(item.asText());
                    }
                });
            }
            return flags;
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

    private long elapsedMs(long startedNanos) {
        return java.time.Duration.ofNanos(System.nanoTime() - startedNanos).toMillis();
    }

    private double estimateCost(String model, int promptTokens, int completionTokens) {
        if (promptTokens <= 0 && completionTokens <= 0) {
            return 0.0;
        }
        boolean isFallback = generationProperties.getFallbackModel() != null
                && generationProperties.getFallbackModel().equals(model);
        double inputPrice = isFallback
                ? generationProperties.getFallbackInputPricePerMillion()
                : generationProperties.getInputPricePerMillion();
        double outputPrice = isFallback
                ? generationProperties.getFallbackOutputPricePerMillion()
                : generationProperties.getOutputPricePerMillion();
        return (promptTokens / 1_000_000.0) * inputPrice
                + (completionTokens / 1_000_000.0) * outputPrice;
    }

    private void logChunkTiming(
            DocumentQuestionJob job,
            DocumentChunk chunk,
            long generatorMs,
            long persistCandidateMs,
            long duplicateCheckMs,
            int candidateCount,
            int llmCallCount,
            String outcome
    ) {
        log.info(
                "Document question chunk processed jobId={} chunkId={} chunkIndex={} tokenCount={} outcome={} generatorMs={} persistCandidateMs={} duplicateCheckMs={} candidateCount={} llmCallCount={}",
                job.getId(),
                chunk.getId(),
                chunk.getChunkIndex(),
                chunk.getTokenCount(),
                outcome,
                generatorMs,
                persistCandidateMs,
                duplicateCheckMs,
                candidateCount,
                llmCallCount
        );
    }

    private record CandidatePersistResult(int createdCount, long duplicateCheckMs, long persistCandidateMs) {
        private static CandidatePersistResult empty() {
            return new CandidatePersistResult(0, 0, 0);
        }
    }

    private static class ChunkOutcome {
        final boolean cancelled;
        final boolean failed;
        final long failedChunkId;
        final long failedChunkIndex;
        final String errorMessage;
        final int createdCandidates;
        final LlmUsage usage;

        private ChunkOutcome(boolean cancelled, boolean failed, long failedChunkId,
                             long failedChunkIndex, String errorMessage,
                             int createdCandidates, LlmUsage usage) {
            this.cancelled = cancelled;
            this.failed = failed;
            this.failedChunkId = failedChunkId;
            this.failedChunkIndex = failedChunkIndex;
            this.errorMessage = errorMessage;
            this.createdCandidates = createdCandidates;
            this.usage = usage;
        }

        static ChunkOutcome cancelledOutcome() {
            return new ChunkOutcome(true, false, 0, 0, null, 0, LlmUsage.empty());
        }

        static ChunkOutcome completedOutcome(int createdCandidates, LlmUsage usage) {
            return new ChunkOutcome(false, false, 0, 0, null, createdCandidates, usage);
        }

        static ChunkOutcome failedOutcome(long chunkId, long chunkIndex, String message) {
            return new ChunkOutcome(false, true, chunkId, chunkIndex,
                    message == null ? "Lỗi không xác định" : message, 0, LlmUsage.empty());
        }

        Map<String, Object> toErrorMap() {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("chunkId", failedChunkId);
            error.put("chunkIndex", failedChunkIndex);
            error.put("message", errorMessage);
            return error;
        }
    }

    private static class ProcessResult {
        private int completedChunks;
        private int failedChunks;
        private int createdCandidates;
        private boolean cancelled;
        private LlmUsage usage = LlmUsage.empty();
        private final List<Map<String, Object>> errors = new ArrayList<>();
    }
}
