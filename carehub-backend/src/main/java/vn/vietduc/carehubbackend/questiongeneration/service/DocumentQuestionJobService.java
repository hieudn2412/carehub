package vn.vietduc.carehubbackend.questiongeneration.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.task.AsyncTaskExecutor;
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

    // Self-injection for @Transactional(REQUIRES_NEW) per chunk
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
                candidateRepository.findByJobOrderByIdAsc(job)
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
            // Đi qua self để mỗi chunk có transaction riêng — nếu chạy thẳng trong transaction
            // của phiên thì một lần save lỗi sẽ đánh dấu rollback-only cho cả phiên.
            ChunkOutcome outcome = self.processSingleChunkTransactional(jobId, chunk.id(), generator);
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
                // Không truyền entity đang được quản lý bởi transaction của thread cha
                // sang thread worker. Mỗi worker phải nạp lại entity trong transaction riêng.
                return self.processSingleChunkTransactional(jobId, chunkId, generator);
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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ChunkOutcome processSingleChunkTransactional(Long jobId, Long chunkId,
                                                          DocumentQuestionGenerator generator) {
        DocumentQuestionJob transactionJob = findJob(jobId);
        DocumentChunk transactionChunk = chunkRepository.findById(chunkId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đoạn nội dung của phiên sinh câu hỏi"));
        return executeSingleChunk(transactionJob, transactionChunk, generator);
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
                return ChunkOutcome.completedOutcome(0, LlmUsage.empty(), 0);
            }
            String firstKey = generationKeyService.candidateKey(
                    generator.provider(),
                    generationProperties.getModel(),
                    generationProperties.getPromptVersion(),
                    job.getQuestionsPerChunk(),
                    chunk.getTextHash(),
                    "vi",
                    categoryId(job),
                    job.getDocument().getId(),
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
                return ChunkOutcome.completedOutcome(0, LlmUsage.empty(), 0);
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
            // Kiểm tra huỷ LẠI ngay trước khi ghi. Lượt kiểm tra lúc task bắt đầu là chưa đủ:
            // giữa hai thời điểm đó có một lời gọi LLM kéo dài tới hàng chục giây, thừa sức để
            // người dùng bấm huỷ. Ghi tiếp thì phiên kết thúc CANCELLED với candidateCount=0
            // nhưng DB lại có ứng viên — số đếm mâu thuẫn với danh sách, và chính các ứng viên
            // đó khoá luôn chunk cho mọi lần chạy sau.
            if (isCancellationRequested(job.getId())) {
                log.info("Bỏ ghi ứng viên vì phiên đã bị huỷ jobId={} chunkId={}", job.getId(), chunk.getId());
                return ChunkOutcome.cancelledOutcome();
            }
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
            double cost = estimateCost(
                    generated.model(),
                    generated.usage().promptTokens(),
                    generated.usage().completionTokens()
            );
            return ChunkOutcome.completedOutcome(persistResult.createdCount(), generated.usage(), cost);
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
            result.estimatedCostUsd += outcome.estimatedCostUsd;
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
        // Nhúng cả lô stem của chunk trong một lần chạy model thay vì mỗi câu một lần.
        double[][] candidateVectors = duplicateCheckService.precomputeVectors(
                questions.stream().map(GeneratedQuestion::stem).toList());
        for (int i = 0; i < questions.size(); i++) {
            GeneratedQuestion question = questions.get(i);
            String generationKey = generationKeyService.candidateKey(
                    provider,
                    generationProperties.getModel(),
                    generationProperties.getPromptVersion(),
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
            DuplicateCheckResult duplicate = duplicateCheckService.check(
                    question.stem(),
                    candidateVectors == null ? null : candidateVectors[i],
                    Set.of(),
                    Set.of()
            );
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
        job.setCompletedChunkCount((resetCounts ? 0 : job.getCompletedChunkCount()) + result.completedChunks);
        job.setFailedChunkCount(result.failedChunks);
        job.setCandidateCount((resetCounts ? 0 : job.getCandidateCount()) + result.createdCandidates);
        job.setChunkErrors(toJson(result.errors));
        job.setLlmCallCount(job.getLlmCallCount() + result.usage.callCount());
        job.setTotalPromptTokens(job.getTotalPromptTokens() + result.usage.promptTokens());
        job.setTotalCompletionTokens(job.getTotalCompletionTokens() + result.usage.completionTokens());
        job.setTotalTokens(job.getTotalTokens() + result.usage.totalTokens());
        job.setTotalLatencyMs(job.getTotalLatencyMs() + result.usage.latencyMs());
        // Chi phí đã được cộng dồn theo từng chunk với đúng model thật sự đã gọi
        // (có thể là fallback model, đơn giá khác hẳn model chính).
        job.setEstimatedCostUsd(job.getEstimatedCostUsd() + result.estimatedCostUsd);
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

    public static class ChunkOutcome {
        final boolean cancelled;
        final boolean failed;
        final long failedChunkId;
        final long failedChunkIndex;
        final String errorMessage;
        final int createdCandidates;
        final LlmUsage usage;
        final double estimatedCostUsd;

        private ChunkOutcome(boolean cancelled, boolean failed, long failedChunkId,
                             long failedChunkIndex, String errorMessage,
                             int createdCandidates, LlmUsage usage, double estimatedCostUsd) {
            this.cancelled = cancelled;
            this.failed = failed;
            this.failedChunkId = failedChunkId;
            this.failedChunkIndex = failedChunkIndex;
            this.errorMessage = errorMessage;
            this.createdCandidates = createdCandidates;
            this.usage = usage;
            this.estimatedCostUsd = estimatedCostUsd;
        }

        static ChunkOutcome cancelledOutcome() {
            return new ChunkOutcome(true, false, 0, 0, null, 0, LlmUsage.empty(), 0);
        }

        static ChunkOutcome completedOutcome(int createdCandidates, LlmUsage usage, double estimatedCostUsd) {
            return new ChunkOutcome(false, false, 0, 0, null, createdCandidates, usage, estimatedCostUsd);
        }

        static ChunkOutcome failedOutcome(long chunkId, long chunkIndex, String message) {
            return new ChunkOutcome(false, true, chunkId, chunkIndex,
                    message == null ? "Lỗi không xác định" : message, 0, LlmUsage.empty(), 0);
        }

        Map<String, Object> toErrorMap() {
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("chunkId", failedChunkId);
            error.put("chunkIndex", failedChunkIndex);
            error.put("message", errorMessage);
            return error;
        }
    }

    public static class ProcessResult {
        private int completedChunks;
        private int failedChunks;
        private int createdCandidates;
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
}
