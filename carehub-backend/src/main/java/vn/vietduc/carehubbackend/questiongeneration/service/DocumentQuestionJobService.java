package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.task.AsyncTaskExecutor;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateDocumentQuestionJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.RetryProblemChunksRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionCandidate;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateLabel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateValidationGrade;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CandidateValidationSource;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ChunkGenerationStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.DocumentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationPipelineVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationProvider;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.TargetCognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGenerator;
import vn.vietduc.carehubbackend.questiongeneration.generation.DocumentQuestionGeneratorRouter;
import vn.vietduc.carehubbackend.questiongeneration.generation.GroundedV4PromptCatalog;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentChunkRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentKnowledgePointRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionCandidateRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionChunkResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.DocumentQuestionJobRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.model.CandidateValidationResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.DuplicateCheckResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ProfessionalFieldPromptOption;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentQuestionJobService {
    /**
     * Trạng thái coi như "đã có kết quả dùng được, không cần sinh lại".
     *
     * <p><b>REJECTED cố ý KHÔNG nằm trong danh sách này.</b> Danh sách được dùng ở hai chỗ:
     * cổng bỏ qua cấp chunk (dựa trên ứng viên chỉ số 0) và cổng bỏ qua từng ứng viên. Khi có
     * REJECTED:</p>
     * <ul>
     *   <li>ứng viên chỉ số 0 từng bị validation từ chối sẽ khoá CẢ CHUNK vĩnh viễn — không lần
     *       chạy lại nào, kể cả retry hay đổi cấu hình, sinh lại được nội dung đó;</li>
     *   <li>nếu chỉ mở cổng cấp chunk mà vẫn chặn ở cấp ứng viên thì còn tệ hơn: hệ thống gọi
     *       LLM (tốn tiền) rồi vứt luôn câu hỏi mới vì chỉ số đó từng bị từ chối.</li>
     * </ul>
     * <p>Bỏ REJECTED ra thì chunk được xử lý lại, câu mới ở chỉ số từng bị từ chối được giữ,
     * còn những chỉ số đã có ứng viên dùng được vẫn bị bỏ qua nên không sinh bản ghi trùng.
     * Bản ghi REJECTED cũ được giữ nguyên làm lịch sử.</p>
     */
    private static final List<CandidateStatus> IDEMPOTENT_STATUSES = List.of(
            CandidateStatus.VALIDATED,
            CandidateStatus.NEED_REVIEW,
            CandidateStatus.APPROVED,
            CandidateStatus.SAVED
    );

    /** Cho test khẳng định thành phần của danh sách — đây là quyết định dễ bị vô tình đảo lại. */
    /* package */ static List<CandidateStatus> idempotentStatuses() {
        return IDEMPOTENT_STATUSES;
    }

    private final QuestionDocumentService documentService;
    private final DocumentChunkRepository chunkRepository;
    private final DocumentQuestionJobRepository jobRepository;
    private final DocumentKnowledgePointRepository knowledgePointRepository;
    private final DocumentQuestionCandidateRepository candidateRepository;
    private final DocumentQuestionChunkResultRepository chunkResultRepository;
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
    private final AsyncTaskExecutor documentChunkExecutor;
    private final GroundedV4PromptCatalog groundedV4Prompts;
    private ProfessionalFieldRepository professionalFieldRepository;

    @org.springframework.beans.factory.annotation.Autowired
    void setProfessionalFieldRepository(ProfessionalFieldRepository professionalFieldRepository) {
        this.professionalFieldRepository = professionalFieldRepository;
    }

    // Self-injection lets prepare/persist run in short REQUIRES_NEW transactions while the
    // external LLM call between them runs without holding a database connection.
    // Mặc định trỏ về chính nó để không NPE khi khởi tạo ngoài Spring (unit test);
    // Spring sẽ ghi đè bằng proxy qua setSelf để @Transactional(REQUIRES_NEW) có hiệu lực.
    private DocumentQuestionJobService self = this;

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

    private List<ProfessionalFieldPromptOption> professionalFieldPromptOptions(DocumentQuestionJob job) {
        if (job.getProfessionalField() != null) {
            ProfessionalField field = job.getProfessionalField();
            return List.of(new ProfessionalFieldPromptOption(field.getCode(), field.getName(), field.getDescription()));
        }
        if (professionalFieldRepository == null) {
            return List.of();
        }
        return professionalFieldRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(field -> new ProfessionalFieldPromptOption(field.getCode(), field.getName(), field.getDescription()))
                .toList();
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
        if ((request == null || request.professionalFieldId() == null)
                && professionalFieldRepository != null
                && professionalFieldRepository.findByActiveTrueOrderByNameAsc().isEmpty()) {
            throw new BadRequestException("Chưa có lĩnh vực chuyên môn đang hoạt động để AI phân loại câu hỏi");
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
        GenerationPipelineVersion pipelineVersion = request != null && request.pipelineVersion() != null
                ? request.pipelineVersion()
                : generationProperties.getDefaultPipeline();
        if (pipelineVersion == null) {
            pipelineVersion = GenerationPipelineVersion.GROUNDED_V4;
        }
        if (pipelineVersion == GenerationPipelineVersion.LEGACY_V3
                && !generationProperties.isAllowLegacyNewJobs()) {
            throw new BadRequestException("Không cho phép tạo phiên Legacy mới; hãy dùng GROUNDED_V4");
        }
        if (pipelineVersion == GenerationPipelineVersion.GROUNDED_V4
                && !generationProperties.isGroundedV4Enabled()) {
            throw new BadRequestException("Pipeline Grounded v4 chưa được bật cho môi trường này");
        }
        TargetCognitiveLevel targetCognitiveLevel = request != null && request.targetCognitiveLevel() != null
                ? request.targetCognitiveLevel()
                : TargetCognitiveLevel.AUTO;
        boolean hasCognitiveMix = request != null && request.hasCognitiveMix();
        if (hasCognitiveMix
                && request.cognitiveMixFoundation()
                + request.cognitiveMixApplication()
                + request.cognitiveMixReasoning() != 100) {
            throw new BadRequestException("Tổng tỷ lệ ba mức nhận thức phải bằng 100%");
        }
        QuestionCategory category = null;
        if (request != null && request.categoryId() != null) {
            category = questionCategoryRepository.findById(request.categoryId())
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy danh mục câu hỏi"));
        }
        ProfessionalField professionalField = null;
        if (request != null && request.professionalFieldId() != null && professionalFieldRepository != null) {
            professionalField = professionalFieldRepository.findById(request.professionalFieldId())
                    .filter(ProfessionalField::isActive)
                    .orElseThrow(() -> new BadRequestException("Không tìm thấy lĩnh vực chuyên môn đang hoạt động"));
        }
        String traceId = java.util.UUID.randomUUID().toString().substring(0, 8);
        DocumentQuestionJob job = DocumentQuestionJob.builder()
                .document(document)
                .category(category)
                .professionalField(professionalField)
                .provider(providerEnum())
                .model(generationProperties.getModel())
                .promptVersion(pipelineVersion == GenerationPipelineVersion.GROUNDED_V4
                        ? groundedV4Prompts.version()
                        : generationProperties.getPromptVersion())
                .promptHash(pipelineVersion == GenerationPipelineVersion.GROUNDED_V4
                        ? groundedV4Prompts.manifestHash()
                        : null)
                .pipelineVersion(pipelineVersion)
                .targetCognitiveLevel(targetCognitiveLevel)
                .cognitiveMixFoundation(hasCognitiveMix ? request.cognitiveMixFoundation() : null)
                .cognitiveMixApplication(hasCognitiveMix ? request.cognitiveMixApplication() : null)
                .cognitiveMixReasoning(hasCognitiveMix ? request.cognitiveMixReasoning() : null)
                .status(JobStatus.CREATED)
                .questionsPerChunk(questionsPerChunk)
                .chunkCount(chunks.size())
                .completedChunkCount(0)
                .failedChunkCount(0)
                .candidateCount(0)
                .eligibleChunkCount((int) eligibleChunkCount)
                .skippedChunkCount(chunks.size() - (int) eligibleChunkCount)
                .problemChunkCount(0)
                .reviewableCandidateCount(0)
                .rejectedCandidateCount(0)
                .criticCallCount(0)
                .chunkErrors("[]")
                .llmCallCount(0)
                .totalPromptTokens(0)
                .totalPromptCacheHitTokens(0)
                .totalPromptCacheMissTokens(0)
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

    /**
     * Không gắn {@code @Transactional}: thân hàm gọi N lời gọi LLM (mỗi lời gọi có thể tới
     * {@code ai.generation.timeout-seconds}), nên bọc cả phiên trong một transaction sẽ giữ
     * connection HikariCP suốt thời gian đó. Thay vào đó tách thành các transaction ngắn:
     * chuẩn bị → xử lý từng chunk ({@code REQUIRES_NEW}) → ghi kết quả.
     */
    public void processJob(Long jobId) {
        List<ChunkRef> chunks = self.prepareJobForProcessing(jobId);
        if (chunks == null) {
            return;
        }
        ProcessResult result = processChunks(jobId, chunks);
        self.applyResultTransactional(jobId, result, true);
    }

    /** @return danh sách chunk cần xử lý, hoặc {@code null} nếu phiên không ở trạng thái chạy được. */
    @Transactional
    public List<ChunkRef> prepareJobForProcessing(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        if (job.getStatus() == JobStatus.CANCELLED) {
            log.info("Skip cancelled document question job jobId={}", jobId);
            return null;
        }
        if (job.getStatus() != JobStatus.CREATED) {
            log.info("Skip document question job processing jobId={} status={}", jobId, job.getStatus());
            return null;
        }
        List<ChunkRef> chunks = toChunkRefs(chunkRepository.findByDocumentOrderByChunkIndexAsc(job.getDocument()));
        job.setStatus(JobStatus.GENERATING);
        job.setCompletedChunkCount(0);
        job.setFailedChunkCount(0);
        job.setCandidateCount(0);
        job.setProblemChunkCount(0);
        job.setReviewableCandidateCount(0);
        job.setRejectedCandidateCount(0);
        job.setCriticCallCount(0);
        job.setChunkErrors("[]");
        job.setErrorMessage(null);
        jobRepository.save(job);
        return chunks;
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
                candidateRepository.findByJobOrderByIdAsc(job),
                chunkResultRepository.findByJobOrderByChunkChunkIndexAscAttemptNoDesc(job)
        );
    }

    @Transactional(readOnly = true)
    public List<DocumentQuestionJobResponse> listByDocument(Long documentId) {
        QuestionDocument document = documentService.findDocument(documentId);
        return jobRepository.findByDocumentOrderByCreatedAtDesc(document).stream()
                .map(job -> mapper.toJobResponse(job, List.of(), List.of()))
                .toList();
    }

    /** Xem ghi chú ở {@link #processJob(Long)} về lý do không bọc transaction quanh cả phiên. */
    public DocumentQuestionJobResponse retryFailedChunks(Long jobId) {
        RetryPlan plan = self.prepareRetry(jobId);
        if (plan.chunks().isEmpty()) {
            return get(jobId);
        }
        ProcessResult result = processChunks(jobId, plan.chunks());
        self.applyResultTransactional(jobId, result, plan.retryAllChunks());
        return get(jobId);
    }

    public DocumentQuestionJobResponse retryProblemChunks(
            Long jobId,
            RetryProblemChunksRequest request
    ) {
        List<ChunkRef> chunks = self.prepareProblemChunkRetry(
                jobId,
                request == null ? null : request.chunkIds()
        );
        if (chunks.isEmpty()) {
            return get(jobId);
        }
        ProcessResult result = processChunks(jobId, chunks);
        self.applyResultTransactional(jobId, result, false);
        return get(jobId);
    }

    @Transactional
    public List<ChunkRef> prepareProblemChunkRetry(Long jobId, List<Long> requestedChunkIds) {
        DocumentQuestionJob job = findJob(jobId);
        if (job.getStatus() == JobStatus.CANCELLED) {
            throw new BadRequestException("Không thể retry phiên tạo câu hỏi đã hủy");
        }
        Set<Long> requested = requestedChunkIds == null ? Set.of() : Set.copyOf(requestedChunkIds);
        Set<Long> seen = new java.util.HashSet<>();
        List<ChunkGenerationStatus> problemStatuses = List.of(
                ChunkGenerationStatus.NO_KNOWLEDGE,
                ChunkGenerationStatus.NO_QUESTIONS,
                ChunkGenerationStatus.VALIDATION_REJECTED,
                ChunkGenerationStatus.FAILED
        );
        List<ChunkRef> chunks = chunkResultRepository
                .findByJobOrderByChunkChunkIndexAscAttemptNoDesc(job)
                .stream()
                .filter(result -> seen.add(result.getChunk().getId()))
                .filter(result -> problemStatuses.contains(result.getStatus()))
                .filter(result -> Boolean.TRUE.equals(result.getRetryable()))
                .filter(result -> requested.isEmpty() || requested.contains(result.getChunk().getId()))
                .map(result -> new ChunkRef(result.getChunk().getId(), result.getChunk().getChunkIndex()))
                .toList();
        if (!chunks.isEmpty()) {
            job.setStatus(JobStatus.GENERATING);
            job.setErrorMessage(null);
            jobRepository.save(job);
        }
        return chunks;
    }

    @Transactional
    public RetryPlan prepareRetry(Long jobId) {
        DocumentQuestionJob job = findJob(jobId);
        if (job.getStatus() == JobStatus.CANCELLED) {
            throw new BadRequestException("Không thể retry phiên tạo câu hỏi đã hủy");
        }
        List<Long> chunkIds = failedChunkIds(job.getChunkErrors());
        boolean retryAllChunks = chunkIds.isEmpty()
                && job.getCandidateCount() == 0
                && job.getStatus() == JobStatus.PARTIALLY_COMPLETED
                && job.getErrorMessage() != null
                && job.getErrorMessage().contains("không có câu hỏi mới");
        if (chunkIds.isEmpty() && !retryAllChunks) {
            return new RetryPlan(List.of(), false);
        }
        List<ChunkRef> chunks = toChunkRefs((retryAllChunks
                ? chunkRepository.findByDocumentOrderByChunkIndexAsc(job.getDocument())
                : chunkRepository.findAllById(chunkIds)).stream()
                .sorted(Comparator.comparing(DocumentChunk::getChunkIndex))
                .toList());
        job.setStatus(JobStatus.GENERATING);
        if (retryAllChunks) {
            job.setCompletedChunkCount(0);
            job.setCandidateCount(0);
        }
        job.setFailedChunkCount(0);
        job.setChunkErrors("[]");
        jobRepository.save(job);
        return new RetryPlan(chunks, retryAllChunks);
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
                candidateRepository.findByJobOrderByIdAsc(job),
                chunkResultRepository.findByJobOrderByChunkChunkIndexAscAttemptNoDesc(job)
        );
    }

    private ProcessResult processChunks(Long jobId, List<ChunkRef> chunks) {
        DocumentQuestionGenerator generator = generatorRouter.current();
        ProcessResult result = new ProcessResult();

        int parallelism = resolveParallelism();
        if (!generationProperties.isParallelChunkProcessing() || parallelism <= 1) {
            return processChunksSequential(jobId, chunks, generator, result);
        }
        return processChunksParallel(jobId, chunks, generator, result);
    }

    private ProcessResult processChunksSequential(Long jobId, List<ChunkRef> chunks,
                                                   DocumentQuestionGenerator generator, ProcessResult result) {
        for (ChunkRef chunk : chunks) {
            if (isCancellationRequested(jobId)) {
                result.cancelled = true;
                break;
            }
            // Mỗi chunk tự mở transaction ngắn ở prepare/persist; lời gọi LLM nằm giữa hai bước.
            ChunkOutcome outcome = processSingleChunk(jobId, chunk.id(), generator);
            mergeOutcome(result, outcome);
            if (outcome.cancelled) {
                break;
            }
        }
        return result;
    }

    private ProcessResult processChunksParallel(Long jobId, List<ChunkRef> chunks,
                                                 DocumentQuestionGenerator generator, ProcessResult result) {
        List<Future<ChunkOutcome>> futures = new ArrayList<>();

        for (ChunkRef chunk : chunks) {
            Long chunkId = chunk.id();
            futures.add(documentChunkExecutor.submit(() -> {
                if (isCancellationRequested(jobId)) {
                    return ChunkOutcome.cancelledOutcome();
                }
                // Chỉ truyền ID bất biến; worker tự nạp entity trong transaction ngắn.
                return processSingleChunk(jobId, chunkId, generator);
            }));
        }

        for (int index = 0; index < futures.size(); index++) {
            Future<ChunkOutcome> future = futures.get(index);
            ChunkRef chunk = chunks.get(index);
            try {
                ChunkOutcome outcome = future.get();
                if (outcome.cancelled) {
                    result.cancelled = true;
                    break;
                }
                mergeOutcome(result, outcome);
            } catch (ExecutionException ex) {
                Throwable cause = ex.getCause() == null ? ex : ex.getCause();
                ChunkOutcome outcome = ChunkOutcome.failedOutcome(
                        chunk.id(),
                        chunk.index(),
                        cause.getMessage()
                );
                mergeOutcome(result, outcome);
                log.warn("Chunk processing failed in parallel jobId={} chunkId={}", jobId, chunk.id(), cause);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                result.cancelled = true;
                break;
            }
        }
        // Pool dùng chung — huỷ những task chưa chạy thay vì shutdown cả pool.
        futures.forEach(future -> future.cancel(false));
        return result;
    }

    private List<ChunkRef> toChunkRefs(List<DocumentChunk> chunks) {
        return chunks.stream()
                .map(chunk -> new ChunkRef(chunk.getId(), chunk.getChunkIndex()))
                .toList();
    }

    public ChunkOutcome processSingleChunk(Long jobId, Long chunkId, DocumentQuestionGenerator generator) {
        long chunkStarted = System.nanoTime();
        ChunkPreparation preparation = self.prepareSingleChunkTransactional(jobId, chunkId, generator);
        if (preparation.completedOutcome() != null) {
            return preparation.completedOutcome();
        }
        MDC.put("traceId", preparation.traceId());
        MDC.put("generationJobId", String.valueOf(jobId));
        MDC.put("generationChunkId", String.valueOf(chunkId));
        MDC.put("generationAttempt", String.valueOf(preparation.attemptNumber()));
        long generatorStarted = System.nanoTime();
        try {
            GeneratedChunkResult generated = generator.generate(preparation.input());
            long generatorMs = elapsedMs(generatorStarted);
            return self.persistGeneratedChunkTransactional(
                    preparation, generated, generator.provider(), generatorMs
            );
        } catch (Exception ex) {
            return self.persistFailedChunkTransactional(preparation, ex, elapsedMs(generatorStarted), chunkStarted);
        } finally {
            MDC.remove("traceId");
            MDC.remove("generationJobId");
            MDC.remove("generationChunkId");
            MDC.remove("generationAttempt");
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ChunkPreparation prepareSingleChunkTransactional(
            Long jobId, Long chunkId, DocumentQuestionGenerator generator
    ) {
        DocumentQuestionJob job = findJob(jobId);
        DocumentChunk chunk = chunkRepository.findById(chunkId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đoạn nội dung của phiên sinh câu hỏi"));
        if (job.getStatus() == JobStatus.CANCELLED) {
            return ChunkPreparation.completed(ChunkOutcome.cancelledOutcome());
        }
        int attemptNumber = chunkResultRepository.findFirstByJobAndChunkOrderByAttemptNoDesc(job, chunk)
                .map(result -> result.getAttemptNo() + 1)
                .orElse(1);
        List<String> qualityFlags = parseQualityFlags(chunk.getQualityFlags());
        if (!DocumentChunkQualityRules.isGenerationEligible(qualityFlags)
                || DocumentChunkQualityRules.isBibliographyLike(chunk.getSectionPath(), chunk.getText())) {
            logChunkTiming(job, chunk, 0, 0, 0, 0, 0, "skipped_quality");
            ChunkOutcome outcome = saveChunkOutcome(job, chunk, attemptNumber, ChunkOutcome.outcome(
                    chunk, ChunkGenerationStatus.SKIPPED_QUALITY, 0, 0, 0, 0,
                    0, 0, LlmUsage.empty(), 0, null, null, false
            ));
            return ChunkPreparation.completed(outcome);
        }
        if (job.getPipelineVersion() != GenerationPipelineVersion.GROUNDED_V4) {
            String firstKey = generationKeyService.candidateKey(
                    generator.provider(), generationProperties.getModel(), job.getPromptVersion(),
                    job.getQuestionsPerChunk(), chunk.getTextHash(), "vi", categoryId(job),
                    job.getDocument().getId(), 0
            );
            long duplicateCheckStarted = System.nanoTime();
            if (candidateRepository.findFirstByGenerationKeyAndStatusIn(firstKey, IDEMPOTENT_STATUSES).isPresent()) {
                long duplicateCheckMs = elapsedMs(duplicateCheckStarted);
                logChunkTiming(job, chunk, 0, 0, duplicateCheckMs, 0, 0, "skipped_existing");
                ChunkOutcome outcome = saveChunkOutcome(job, chunk, attemptNumber, ChunkOutcome.outcome(
                        chunk, ChunkGenerationStatus.COMPLETED, 0, 0, 0, 0,
                        0, 0, LlmUsage.empty(), 0, null, null, false
                ));
                return ChunkPreparation.completed(outcome);
            }
        }
        GenerationInput input = new GenerationInput(
                job.getDocument().getId(), job.getId(), chunk.getId(), chunk.getText(), chunk.getSectionPath(),
                job.getQuestionsPerChunk(), "vi", job.getDocument().getFilename(), chunk.getPageStart(),
                chunk.getPageEnd(), job.getCategory() == null ? null : job.getCategory().getName(),
                job.getCategory() == null ? null : job.getCategory().getDescription(),
                cognitiveDirective(job, chunk.getChunkIndex()),
                job.getPipelineVersion() == null ? GenerationPipelineVersion.LEGACY_V3.name() : job.getPipelineVersion().name(),
                professionalFieldPromptOptions(job)
        );
        return new ChunkPreparation(jobId, chunkId, attemptNumber,
                blankToFallback(job.getTraceId(), "unknown"), input, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ChunkOutcome persistGeneratedChunkTransactional(
            ChunkPreparation preparation,
            GeneratedChunkResult generated,
            String provider,
            long generatorMs
    ) {
        DocumentQuestionJob job = jobRepository.findByIdForUpdate(preparation.jobId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiên tạo câu hỏi"));
        DocumentChunk chunk = chunkRepository.findById(preparation.chunkId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đoạn nội dung của phiên sinh câu hỏi"));
        if (job.getStatus() == JobStatus.CANCELLED) {
            log.info("Bỏ ghi ứng viên vì phiên đã bị huỷ jobId={} chunkId={}", job.getId(), chunk.getId());
            return saveChunkOutcome(job, chunk, preparation.attemptNumber(), ChunkOutcome.outcome(
                    chunk, ChunkGenerationStatus.CANCELLED,
                    generated.knowledgePoints().size(), generated.questions().size(), 0, 0,
                    generated.criticCallCount(), generated.repairCallCount(), generated.usage(),
                    generated.usage().estimatedCostUsd(), "CANCELLED", "Phiên đã bị hủy", false
            ));
        }
        long persistKnowledgeStarted = System.nanoTime();
        persistKnowledgePoints(job, chunk, generated.knowledgePoints());
        long persistKnowledgeMs = elapsedMs(persistKnowledgeStarted);
        CandidatePersistResult persistResult = persistCandidates(
                job,
                chunk,
                generated.questions(),
                provider,
                preparation.attemptNumber(),
                generated.knowledgePoints().stream()
                        .map(GeneratedKnowledgePoint::id)
                        .collect(java.util.stream.Collectors.toSet())
        );
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
        double cost = generated.usage().estimatedCostUsd();
        ChunkGenerationStatus status;
        boolean retryable;
        if (job.getPipelineVersion() == GenerationPipelineVersion.GROUNDED_V4
                && generated.knowledgePoints().isEmpty()) {
            status = ChunkGenerationStatus.NO_KNOWLEDGE;
            retryable = true;
        } else if (generated.questions().isEmpty()) {
            status = ChunkGenerationStatus.NO_QUESTIONS;
            retryable = true;
        } else if (persistResult.reviewableCount() == 0) {
            status = ChunkGenerationStatus.VALIDATION_REJECTED;
            retryable = true;
        } else {
            status = ChunkGenerationStatus.COMPLETED;
            retryable = false;
        }
        return saveChunkOutcome(job, chunk, preparation.attemptNumber(), ChunkOutcome.outcome(
                chunk,
                status,
                generated.knowledgePoints().size(),
                generated.questions().size(),
                persistResult.reviewableCount(),
                persistResult.rejectedCount(),
                generated.criticCallCount(),
                generated.repairCallCount(),
                generated.usage(),
                cost,
                null,
                null,
                retryable
        ));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ChunkOutcome persistFailedChunkTransactional(
            ChunkPreparation preparation, Exception ex, long generatorMs, long chunkStarted
    ) {
        DocumentQuestionJob job = jobRepository.findByIdForUpdate(preparation.jobId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiên tạo câu hỏi"));
        DocumentChunk chunk = chunkRepository.findById(preparation.chunkId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đoạn nội dung của phiên sinh câu hỏi"));
        if (job.getStatus() == JobStatus.CANCELLED) {
            return saveChunkOutcome(job, chunk, preparation.attemptNumber(), ChunkOutcome.outcome(
                    chunk, ChunkGenerationStatus.CANCELLED, 0, 0, 0, 0,
                    0, 0, LlmUsage.empty(), 0, "CANCELLED", "Phiên đã bị hủy", false
            ));
        }
        CandidatePersistResult persistResult = CandidatePersistResult.empty();
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
            LlmUsage failedUsage = ex instanceof vn.vietduc.carehubbackend.questiongeneration.generation
                    .DeepSeekDocumentQuestionGenerator.DeepSeekGenerationException generationFailure
                    ? generationFailure.usage() : LlmUsage.empty();
            String errorCode = ex instanceof vn.vietduc.carehubbackend.questiongeneration.generation
                    .DeepSeekDocumentQuestionGenerator.DeepSeekGenerationException generationFailure
                    ? generationFailure.errorCode()
                    : ex.getMessage() != null && ex.getMessage().contains("INVALID_MODEL_OUTPUT")
                    ? "INVALID_MODEL_OUTPUT" : "CHUNK_PROCESSING_FAILED";
            boolean retryable = !List.of("DEEPSEEK_AUTHENTICATION", "DEEPSEEK_BAD_REQUEST",
                    "DEEPSEEK_CONTENT_FILTER").contains(errorCode);
            return saveChunkOutcome(job, chunk, preparation.attemptNumber(), ChunkOutcome.outcome(
                    chunk,
                    ChunkGenerationStatus.FAILED,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    failedUsage,
                    failedUsage.estimatedCostUsd(),
                    errorCode,
                    blankToFallback(ex.getMessage(), "Lỗi không xác định"),
                    retryable
            ));
    }

    private void mergeOutcome(ProcessResult result, ChunkOutcome outcome) {
        if (outcome.cancelled) {
            result.cancelled = true;
            return;
        }
        if (outcome.failed) {
            result.failedChunks++;
            result.errors.add(outcome.toErrorMap());
        } else {
            result.completedChunks++;
        }
        if (outcome.problem) {
            result.problemChunks++;
        }
        if (outcome.status == ChunkGenerationStatus.SKIPPED_QUALITY) {
            result.skippedChunks++;
        }
        result.createdCandidates += outcome.createdCandidates;
        result.reviewableCandidates += outcome.reviewableCandidates;
        result.rejectedCandidates += outcome.rejectedCandidates;
        result.criticCalls += outcome.criticCalls;
        result.usage = result.usage.plus(outcome.usage);
        result.estimatedCostUsd += outcome.estimatedCostUsd;
    }

    private ChunkOutcome saveChunkOutcome(
            DocumentQuestionJob job,
            DocumentChunk chunk,
            int attemptNumber,
            ChunkOutcome outcome
    ) {
        DocumentQuestionChunkResult entity = DocumentQuestionChunkResult.builder()
                .job(job)
                .chunk(chunk)
                .attemptNo(attemptNumber)
                .status(outcome.status)
                .knowledgePointCount(outcome.knowledgePointCount)
                .rawQuestionCount(outcome.rawQuestionCount)
                .reviewableCount(outcome.reviewableCandidates)
                .rejectedCount(outcome.rejectedCandidates)
                .criticCallCount(outcome.criticCalls)
                .repairCallCount(outcome.repairCalls)
                .llmCallCount(outcome.usage.callCount())
                .promptTokens(outcome.usage.promptTokens())
                .promptCacheHitTokens(outcome.usage.promptCacheHitTokens())
                .promptCacheMissTokens(outcome.usage.promptCacheMissTokens())
                .completionTokens(outcome.usage.completionTokens())
                .totalTokens(outcome.usage.totalTokens())
                .latencyMs(outcome.usage.latencyMs())
                .estimatedCostUsd(outcome.usage.estimatedCostUsd())
                .errorCode(outcome.errorCode)
                .errorMessage(outcome.errorMessage)
                .retryable(outcome.retryable)
                .build();
        chunkResultRepository.save(entity);
        return outcome;
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
            if (knowledgePointRepository.existsByJobAndChunkAndSourceKey(job, chunk, point.id())) {
                continue;
            }
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
            String provider,
            int attemptNumber,
            Set<String> groundedKnowledgePointKeys
    ) {
        int created = 0;
        int reviewable = 0;
        int rejected = 0;
        long duplicateCheckMs = 0;
        long persistCandidateMs = 0;
        String categoryTopic = job.getCategory() != null ? job.getCategory().getName() : null;
        // Nhúng cả lô stem của chunk trong một lần chạy model thay vì mỗi câu một lần.
        List<String> stems = questions.stream().map(GeneratedQuestion::stem).toList();
        double[][] candidateVectors = duplicateCheckService.precomputeVectors(stems);
        for (int i = 0; i < questions.size(); i++) {
            GeneratedQuestion question = questions.get(i);
            ProfessionalField questionProfessionalField = resolveGeneratedProfessionalField(job, question.professionalFieldCode());
            CognitiveLevel questionCognitiveLevel = resolveGeneratedCognitiveLevel(job, chunk.getChunkIndex(), question.cognitiveLevel());
            String generationKey = job.getPipelineVersion() == GenerationPipelineVersion.GROUNDED_V4
                    ? generationKeyService.groundedCandidateKey(
                            provider,
                            generationProperties.getModel(),
                            job.getPipelineVersion().name(),
                            job.getPromptHash(),
                            job.getDocument().getId(),
                            chunk.getId(),
                            chunk.getTextHash(),
                            categoryId(job),
                            job.getQuestionsPerChunk(),
                            cognitiveKey(job),
                            i,
                            attemptNumber
                    )
                    : generationKeyService.candidateKey(
                            provider,
                            generationProperties.getModel(),
                            job.getPromptVersion(),
                            job.getQuestionsPerChunk(),
                            chunk.getTextHash(),
                            "vi",
                            categoryId(job),
                            job.getDocument().getId(),
                            i
                    );
            long duplicateStarted = System.nanoTime();
            if (candidateRepository.findFirstByGenerationKeyAndStatusIn(generationKey, IDEMPOTENT_STATUSES).isPresent()) {
                duplicateCheckMs += elapsedMs(duplicateStarted);
                continue;
            }
            CandidateValidationResult validation = validationService.validate(question, chunk.getText());
            // Chỉ còn là cảnh báo: liên kết knowledge point sai không làm hỏng cấu trúc câu hỏi.
            boolean invalidKnowledgePointLink = job.getPipelineVersion() == GenerationPipelineVersion.GROUNDED_V4
                    && !groundedKnowledgePointKeys.contains(question.knowledgePointId());
            DuplicateCheckResult duplicate = duplicateCheckService.check(
                    question.stem(),
                    candidateVectors == null ? null : candidateVectors[i],
                    Set.of(),
                    Set.of()
            );
            DuplicateCheckResult inBatchDuplicate = duplicateCheckService.checkWithinBatch(
                    stems,
                    candidateVectors,
                    i
            );
            if (inBatchDuplicate.maxSimilarity() > duplicate.maxSimilarity()) {
                duplicate = inBatchDuplicate;
            }
            duplicateCheckMs += elapsedMs(duplicateStarted);
            List<String> warnings = new ArrayList<>(validation.warnings());
            if (invalidKnowledgePointLink) {
                warnings.add("Knowledge point không tồn tại trong kết quả Stage A đã được grounding");
            }
            if (duplicate.warning() != null && !duplicate.warning().isBlank()) {
                warnings.add(duplicate.warning());
            }
            if (questionProfessionalField == null) {
                warnings.add("Chưa phân loại được lĩnh vực chuyên môn cho riêng câu hỏi; reviewer cần chọn lại");
            }
            if (questionCognitiveLevel == null) {
                warnings.add("Chưa phân loại được mức độ nhận thức; reviewer cần chọn lại");
            }
            if (job.getCategory() == null) {
                warnings.add("Chưa có danh mục câu hỏi; reviewer cần chọn danh mục trước khi duyệt");
            }
            CandidateStatus status;
            CandidateLabel label;
            // NEED_REVIEW mang đúng hai nghĩa: nghi ngờ trùng, hoặc AI critic có kết luận xấu.
            // Thiếu lĩnh vực/mức nhận thức/danh mục vẫn hiện bằng mini-badge trên thẻ câu hỏi
            // nên không cần gắn cờ thêm ở đây.
            boolean criticFailed = "FAILED".equals(validation.criticStatus());
            if (validation.rejected()) {
                status = CandidateStatus.REJECTED;
                label = CandidateLabel.REJECTED;
            } else if (criticFailed || duplicate.needsReview() || duplicate.strongDuplicate()) {
                status = CandidateStatus.NEED_REVIEW;
                label = CandidateLabel.NEED_REVIEW;
                if (duplicate.strongDuplicate()) {
                    warnings.add("Trùng ngữ nghĩa mạnh với câu hỏi đã có; cần người duyệt quyết định");
                } else if (duplicate.needsReview()) {
                    warnings.add("Có khả năng trùng ngữ nghĩa với câu hỏi đã có");
                }
            } else {
                status = CandidateStatus.VALIDATED;
                label = CandidateLabel.GOOD;
            }
            if (status == CandidateStatus.REJECTED) {
                rejected++;
            } else {
                reviewable++;
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
                    .category(job.getCategory())
                    .professionalField(questionProfessionalField)
                    .cognitiveLevel(questionCognitiveLevel)
                    .sourceExcerpt(question.sourceExcerpt())
                    .knowledgePointKey(question.knowledgePointId())
                    .questionType(question.questionType())
                    .answerEvidence(question.answerEvidence())
                    .distractorRationales(question.distractorRationales())
                    .generationKey(generationKey)
                    .rawJson(blankToFallback(question.rawJson(), "{}"))
                    .qualityScore(validation.qualityScore())
                    .llmValidation(question.llmValidationJson())
                    .validationGrade(CandidateValidationGrade.valueOf(validation.validationGrade()))
                    .validationSource(CandidateValidationSource.valueOf(validation.validationSource()))
                    .validationIssues(toJson(validation.warnings()))
                    .evidenceStatus(validation.evidenceStatus())
                    .criticStatus(validation.criticStatus())
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
        return new CandidatePersistResult(created, reviewable, rejected, duplicateCheckMs, persistCandidateMs);
    }

    @Transactional
    public void applyResultTransactional(Long jobId, ProcessResult result, boolean resetCounts) {
        applyResult(findJob(jobId), result, resetCounts);
    }

    private void applyResult(DocumentQuestionJob job, ProcessResult result, boolean resetCounts) {
        if (result.cancelled || isCancellationRequested(job.getId())) {
            job.setStatus(JobStatus.CANCELLED);
            job.setErrorMessage("Phiên tạo câu hỏi đã được hủy bởi người dùng");
            jobRepository.save(job);
            return;
        }
        Set<Long> seenChunks = new java.util.HashSet<>();
        List<DocumentQuestionChunkResult> latestOutcomes = chunkResultRepository
                .findByJobOrderByChunkChunkIndexAscAttemptNoDesc(job)
                .stream()
                .filter(outcome -> seenChunks.add(outcome.getChunk().getId()))
                .toList();
        long failedChunks = latestOutcomes.stream()
                .filter(outcome -> outcome.getStatus() == ChunkGenerationStatus.FAILED)
                .count();
        long skippedChunks = latestOutcomes.stream()
                .filter(outcome -> outcome.getStatus() == ChunkGenerationStatus.SKIPPED_QUALITY)
                .count();
        long problemChunks = latestOutcomes.stream()
                .filter(outcome -> List.of(
                        ChunkGenerationStatus.NO_KNOWLEDGE,
                        ChunkGenerationStatus.NO_QUESTIONS,
                        ChunkGenerationStatus.VALIDATION_REJECTED,
                        ChunkGenerationStatus.FAILED
                ).contains(outcome.getStatus()))
                .count();
        List<DocumentQuestionCandidate> allCandidates = candidateRepository.findByJobOrderByIdAsc(job);
        long rejectedCandidates = allCandidates.stream()
                .filter(candidate -> candidate.getStatus() == CandidateStatus.REJECTED)
                .count();
        long reviewableCandidates = allCandidates.size() - rejectedCandidates;

        job.setCompletedChunkCount((int) (latestOutcomes.size() - failedChunks));
        job.setFailedChunkCount((int) failedChunks);
        job.setCandidateCount(allCandidates.size());
        job.setSkippedChunkCount((int) skippedChunks);
        job.setProblemChunkCount((int) problemChunks);
        job.setReviewableCandidateCount((int) reviewableCandidates);
        job.setRejectedCandidateCount((int) rejectedCandidates);
        job.setCriticCallCount(latestOutcomes.stream()
                .mapToInt(DocumentQuestionChunkResult::getCriticCallCount)
                .sum());
        job.setChunkErrors(toJson(latestOutcomes.stream()
                .filter(outcome -> outcome.getStatus() == ChunkGenerationStatus.FAILED)
                .map(outcome -> Map.of(
                        "chunkId", outcome.getChunk().getId(),
                        "chunkIndex", outcome.getChunk().getChunkIndex(),
                        "code", blankToFallback(outcome.getErrorCode(), "CHUNK_PROCESSING_FAILED"),
                        "message", blankToFallback(outcome.getErrorMessage(), "Lỗi không xác định")
                ))
                .toList()));
        job.setLlmCallCount(zero(job.getLlmCallCount()) + result.usage.callCount());
        job.setTotalPromptTokens(zero(job.getTotalPromptTokens()) + result.usage.promptTokens());
        job.setTotalPromptCacheHitTokens(zero(job.getTotalPromptCacheHitTokens()) + result.usage.promptCacheHitTokens());
        job.setTotalPromptCacheMissTokens(zero(job.getTotalPromptCacheMissTokens()) + result.usage.promptCacheMissTokens());
        job.setTotalCompletionTokens(zero(job.getTotalCompletionTokens()) + result.usage.completionTokens());
        job.setTotalTokens(zero(job.getTotalTokens()) + result.usage.totalTokens());
        job.setTotalLatencyMs(zero(job.getTotalLatencyMs()) + result.usage.latencyMs());
        // Chi phí đã được cộng dồn theo từng chunk với đúng model thật sự đã gọi
        // (có thể là fallback model, đơn giá khác hẳn model chính).
        job.setEstimatedCostUsd(zero(job.getEstimatedCostUsd()) + result.estimatedCostUsd);
        if (reviewableCandidates > 0 && problemChunks == 0) {
            job.setStatus(JobStatus.GENERATED);
            job.setErrorMessage(null);
        } else if (reviewableCandidates > 0) {
            job.setStatus(JobStatus.PARTIALLY_COMPLETED);
            job.setErrorMessage(null);
        } else {
            job.setStatus(JobStatus.FAILED);
            job.setErrorMessage("Phiên không tạo được candidate có thể duyệt");
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

    private Long categoryId(DocumentQuestionJob job) {
        return job.getCategory() == null ? null : job.getCategory().getId();
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

    /**
     * Chuẩn hoá đáp án về một trong A/B/C/D.
     *
     * <p>Không tự đặt về "A" khi model trả giá trị lạ: câu đó đã bị
     * {@link QuestionCandidateValidationService} đánh dấu REJECTED, nhưng nếu ta ghi đè
     * bằng "A" thì bản ghi lưu lại một đáp án bịa — người duyệt thủ công sau này sẽ
     * không có cách nào biết đáp án gốc không hợp lệ.</p>
     */
    private String normalizeAnswer(String answer) {
        if (answer == null) {
            return "";
        }
        String normalized = answer.trim().toUpperCase();
        return normalized.matches("[ABCD]") ? normalized : "";
    }

    /**
     * Chỉ thị mức nhận thức gửi kèm prompt cho MỘT chunk.
     *
     * <p>Prompt được gửi theo từng chunk, mà mỗi chunk chỉ sinh 1–3 câu, nên gửi thẳng
     * tỷ lệ xuống là vô nghĩa: model không thể phân bổ tỷ lệ trong phạm vi một câu, và
     * các lần gọi độc lập nhau nên không lần nào giữ được tỷ lệ trên toàn phiên. Vì vậy
     * backend tự quy tỷ lệ thành MỘT mức cụ thể cho từng chunk; tỷ lệ do backend bảo đảm
     * chứ không phó mặc cho model.</p>
     *
     * <p>Giới hạn đã biết: tỷ lệ được tính trên số chunk, nên khi questionsPerChunk &gt; 1
     * thì mọi câu trong cùng một chunk chia chung một mức mục tiêu — tỷ lệ thực tế vẫn
     * bám sát nhưng thô hơn. Muốn mịn hơn thì phải phân bổ theo từng câu.</p>
     */
    private static String cognitiveDirective(DocumentQuestionJob job, Integer chunkIndex) {
        if (hasCognitiveMix(job)) {
            CognitiveLevel target = levelForChunk(job, chunkIndex == null ? 0 : chunkIndex);
            return ("Mức mục tiêu cho chunk này: %s (%s). Tỷ lệ toàn phiên do hệ thống phân bổ "
                    + "sẵn theo từng chunk — dễ %d%%, trung bình %d%%, khó %d%% — nên chỉ cần bám "
                    + "đúng mức mục tiêu ở trên và KHÔNG bịa thêm tình huống ngoài nguồn chỉ để đạt mức.")
                    .formatted(
                            target.name(),
                            cognitiveLevelInVietnamese(target),
                            job.getCognitiveMixFoundation(),
                            job.getCognitiveMixApplication(),
                            job.getCognitiveMixReasoning()
                    );
        }
        return job.getTargetCognitiveLevel() == null
                ? TargetCognitiveLevel.AUTO.name()
                : job.getTargetCognitiveLevel().name();
    }

    /**
     * Quy tỷ lệ phần trăm thành mức cho chunk thứ {@code chunkIndex}.
     *
     * <p>Mỗi bước chọn mức đang thiếu nhiều nhất so với hạn mức của nó
     * ({@code phanTram * soChunk / 100} trừ đi số đã phát). Cách này giữ đúng tỷ lệ ở mọi
     * đoạn đầu của dãy, nên phiên ít chunk cũng không bị lệch.</p>
     *
     * <p>Không tính riêng từng mức rồi cộng lại: khi hai mức cùng "đến lượt" ở một chỉ số
     * thì mức xét sau sẽ mất lượt vĩnh viễn và tỷ lệ hụt đi (20/50/30 từng ra 20/40/40).</p>
     */
    /* package */ static CognitiveLevel levelForChunk(DocumentQuestionJob job, int chunkIndex) {
        int[] share = {
                job.getCognitiveMixFoundation(),
                job.getCognitiveMixApplication(),
                job.getCognitiveMixReasoning()
        };
        CognitiveLevel[] levels = {
                CognitiveLevel.FOUNDATION,
                CognitiveLevel.CLINICAL_APPLICATION,
                CognitiveLevel.CLINICAL_REASONING_ANALYSIS
        };
        int[] issued = new int[3];
        int picked = 2;
        for (int n = 1; n <= Math.max(0, chunkIndex) + 1; n++) {
            picked = 0;
            double bestDeficit = share[0] * n / 100.0 - issued[0];
            for (int i = 1; i < 3; i++) {
                double deficit = share[i] * n / 100.0 - issued[i];
                if (deficit > bestDeficit) {
                    bestDeficit = deficit;
                    picked = i;
                }
            }
            issued[picked]++;
        }
        return levels[picked];
    }

    /** Bệnh viện quen gọi ba mức là dễ / trung bình / khó; nói kèm cho model dễ hiểu. */
    private static String cognitiveLevelInVietnamese(CognitiveLevel level) {
        return switch (level) {
            case FOUNDATION -> "dễ";
            case CLINICAL_APPLICATION -> "trung bình";
            case CLINICAL_REASONING_ANALYSIS -> "khó";
        };
    }

    /** Phần mức nhận thức trong khoá chống sinh trùng; đổi tỷ lệ phải ra khoá khác. */
    private static String cognitiveKey(DocumentQuestionJob job) {
        if (hasCognitiveMix(job)) {
            return "MIX:%d-%d-%d".formatted(
                    job.getCognitiveMixFoundation(),
                    job.getCognitiveMixApplication(),
                    job.getCognitiveMixReasoning()
            );
        }
        return job.getTargetCognitiveLevel() == null
                ? TargetCognitiveLevel.AUTO.name()
                : job.getTargetCognitiveLevel().name();
    }

    private static boolean hasCognitiveMix(DocumentQuestionJob job) {
        return job.getCognitiveMixFoundation() != null
                && job.getCognitiveMixApplication() != null
                && job.getCognitiveMixReasoning() != null;
    }

    private String blankToFallback(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private ProfessionalField resolveGeneratedProfessionalField(DocumentQuestionJob job, String code) {
        String normalizedCode = code == null ? null : code.trim();
        if (normalizedCode == null || normalizedCode.isBlank()) {
            // Backward compatibility for callers that explicitly constrained a whole job
            // to one field before per-question classification was introduced.
            return job.getProfessionalField();
        }
        if (job.getProfessionalField() != null) {
            return job.getProfessionalField().getCode().equalsIgnoreCase(normalizedCode)
                    ? job.getProfessionalField()
                    : null;
        }
        if (professionalFieldRepository == null) {
            return null;
        }
        return professionalFieldRepository.findByCode(normalizedCode)
                .filter(ProfessionalField::isActive)
                .orElse(null);
    }

    private CognitiveLevel resolveGeneratedCognitiveLevel(DocumentQuestionJob job, Integer chunkIndex, String value) {
        if (hasCognitiveMix(job)) {
            return levelForChunk(job, chunkIndex == null ? 0 : chunkIndex);
        }
        if (job.getTargetCognitiveLevel() != null
                && job.getTargetCognitiveLevel() != TargetCognitiveLevel.AUTO) {
            return CognitiveLevel.valueOf(job.getTargetCognitiveLevel().name());
        }
        return parseCognitiveLevel(value);
    }

    /**
     * Mức độ nhận thức do AI đề xuất. Giá trị lạ được bỏ qua (null) để người duyệt
     * tự phân loại, thay vì gán bừa một mức không có bằng chứng.
     */
    private CognitiveLevel parseCognitiveLevel(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel
                    .valueOf(value.trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private int zero(Integer value) {
        return value == null ? 0 : value;
    }

    private long zero(Long value) {
        return value == null ? 0L : value;
    }

    private double zero(Double value) {
        return value == null ? 0.0 : value;
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

    private record CandidatePersistResult(
            int createdCount,
            int reviewableCount,
            int rejectedCount,
            long duplicateCheckMs,
            long persistCandidateMs
    ) {
        private static CandidatePersistResult empty() {
            return new CandidatePersistResult(0, 0, 0, 0, 0);
        }
    }

    public static class ChunkOutcome {
        final boolean cancelled;
        final boolean failed;
        final boolean problem;
        final long failedChunkId;
        final long failedChunkIndex;
        final ChunkGenerationStatus status;
        final String errorCode;
        final String errorMessage;
        final int createdCandidates;
        final int knowledgePointCount;
        final int rawQuestionCount;
        final int reviewableCandidates;
        final int rejectedCandidates;
        final int criticCalls;
        final int repairCalls;
        final boolean retryable;
        final LlmUsage usage;
        final double estimatedCostUsd;

        private ChunkOutcome(
                DocumentChunk chunk,
                ChunkGenerationStatus status,
                int knowledgePointCount,
                int rawQuestionCount,
                int reviewableCandidates,
                int rejectedCandidates,
                int criticCalls,
                int repairCalls,
                LlmUsage usage,
                double estimatedCostUsd,
                String errorCode,
                String errorMessage,
                boolean retryable
        ) {
            this.cancelled = status == ChunkGenerationStatus.CANCELLED;
            this.failed = status == ChunkGenerationStatus.FAILED;
            this.problem = List.of(
                    ChunkGenerationStatus.NO_KNOWLEDGE,
                    ChunkGenerationStatus.NO_QUESTIONS,
                    ChunkGenerationStatus.VALIDATION_REJECTED,
                    ChunkGenerationStatus.FAILED
            ).contains(status);
            this.failedChunkId = chunk == null ? 0 : chunk.getId();
            this.failedChunkIndex = chunk == null ? 0 : chunk.getChunkIndex();
            this.status = status;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
            this.knowledgePointCount = knowledgePointCount;
            this.rawQuestionCount = rawQuestionCount;
            this.reviewableCandidates = reviewableCandidates;
            this.rejectedCandidates = rejectedCandidates;
            this.createdCandidates = reviewableCandidates + rejectedCandidates;
            this.criticCalls = criticCalls;
            this.repairCalls = repairCalls;
            this.retryable = retryable;
            this.usage = usage;
            this.estimatedCostUsd = estimatedCostUsd;
        }

        static ChunkOutcome cancelledOutcome() {
            return new ChunkOutcome(
                    null, ChunkGenerationStatus.CANCELLED, 0, 0, 0, 0,
                    0, 0, LlmUsage.empty(), 0, "CANCELLED", "Phiên đã bị hủy", false
            );
        }

        static ChunkOutcome completedOutcome(int createdCandidates, LlmUsage usage, double estimatedCostUsd) {
            return new ChunkOutcome(
                    null, ChunkGenerationStatus.COMPLETED, 0, createdCandidates,
                    createdCandidates, 0, 0, 0, usage, estimatedCostUsd, null, null, false
            );
        }

        static ChunkOutcome failedOutcome(long chunkId, long chunkIndex, String message) {
            DocumentChunk placeholder = DocumentChunk.builder()
                    .id(chunkId)
                    .chunkIndex((int) chunkIndex)
                    .build();
            return new ChunkOutcome(
                    placeholder, ChunkGenerationStatus.FAILED, 0, 0, 0, 0,
                    0, 0, LlmUsage.empty(), 0, "CHUNK_PROCESSING_FAILED",
                    message == null ? "Lỗi không xác định" : message, true
            );
        }

        static ChunkOutcome outcome(
                DocumentChunk chunk,
                ChunkGenerationStatus status,
                int knowledgePointCount,
                int rawQuestionCount,
                int reviewableCandidates,
                int rejectedCandidates,
                int criticCalls,
                int repairCalls,
                LlmUsage usage,
                double estimatedCostUsd,
                String errorCode,
                String errorMessage,
                boolean retryable
        ) {
            return new ChunkOutcome(
                    chunk, status, knowledgePointCount, rawQuestionCount,
                    reviewableCandidates, rejectedCandidates, criticCalls, repairCalls,
                    usage, estimatedCostUsd, errorCode, errorMessage, retryable
            );
        }

        Map<String, Object> toErrorMap() {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("chunkId", failedChunkId);
            error.put("chunkIndex", failedChunkIndex);
            error.put("code", errorCode);
            error.put("message", errorMessage);
            return error;
        }
    }

    public static class ProcessResult {
        private int completedChunks;
        private int failedChunks;
        private int problemChunks;
        private int skippedChunks;
        private int createdCandidates;
        private int reviewableCandidates;
        private int rejectedCandidates;
        private int criticCalls;
        private boolean cancelled;
        private double estimatedCostUsd;
        private LlmUsage usage = LlmUsage.empty();
        private final List<Map<String, Object>> errors = new ArrayList<>();
    }

    /** Tham chiếu chunk đã tách khỏi persistence context, an toàn khi truyền sang thread khác. */
    public record ChunkRef(Long id, Integer index) {
    }

    public record RetryPlan(List<ChunkRef> chunks, boolean retryAllChunks) {
    }

    public record ChunkPreparation(
            Long jobId,
            Long chunkId,
            int attemptNumber,
            String traceId,
            GenerationInput input,
            ChunkOutcome completedOutcome
    ) {
        static ChunkPreparation completed(ChunkOutcome outcome) {
            return new ChunkPreparation(null, null, 0, null, null, outcome);
        }
    }
}
