# Phase 2: Parallel Chunk Processing & Batch Validation

> **Mục tiêu:** Tăng throughput xử lý chunk bằng parallel processing trong giới hạn rate limit
> **Độ phức tạp:** Trung bình | **Risk:** Trung bình | **Kỳ vọng:** Throughput tăng 2-4x

---

## 2.1 Hiện trạng — Xử lý chunk tuần tự

### File: `DocumentQuestionJobService.java` (lines 211-295)

```java
private ProcessResult processChunks(DocumentQuestionJob job, List<DocumentChunk> chunks) {
    DocumentQuestionGenerator generator = generatorRouter.current();
    ProcessResult result = new ProcessResult();
    for (DocumentChunk chunk : chunks) {  // ← TUẦN TỰ từng chunk!
        // 1. Check quality flags
        // 2. Check idempotency (generation key)
        // 3. Gọi DeepSeek API (network I/O, ~2-10s)
        // 4. Persist knowledge points
        // 5. Persist candidates + validate + dedup
        // ...
    }
    return result;
}
```

### Vấn đề:
- Mỗi chunk mất ~3-10s (network I/O)
- 20 chunks → 60-200s tuần tự
- `maxConcurrentCalls=2` → có thể gọi 2 API calls đồng thời, nhưng chỉ đang gọi 1 (vì chỉ 1 chunk được xử lý tại 1 thời điểm)
- Semaphore permit bị lãng phí — chỉ dùng 1/2 capacity

---

## 2.2 Giải pháp: Parallel chunk processing với bounded concurrency

### Ý tưởng

Xử lý nhiều chunk song song, mỗi chunk dùng 1 slot trong semaphore của DeepSeek generator. Giới hạn bởi `maxConcurrentCalls`.

```
Trước (tuần tự):
  Chunk 1 [====API call====] → Chunk 2 [====API call====] → Chunk 3 ...
  Total: 20 chunks × 5s = 100s

Sau (parallel, maxConcurrentCalls=2):
  Chunk 1 [====API call====]
  Chunk 2 [====API call====]
  Chunk 3   [====API call====]
  Chunk 4   [====API call====]
  ...
  Total: 20 chunks × 5s / 2 = 50s (nhanh hơn 2x)
```

Với `maxConcurrentCalls=4` và single_call pipeline: nhanh hơn ~4x.

### Implementation:

**File: `DocumentQuestionJobService.java`**

```java
private ProcessResult processChunks(DocumentQuestionJob job, List<DocumentChunk> chunks) {
    DocumentQuestionGenerator generator = generatorRouter.current();
    ProcessResult result = new ProcessResult();

    int parallelism = generationProperties.getMaxConcurrentCalls();
    ExecutorService chunkExecutor = Executors.newFixedThreadPool(parallelism);

    List<Future<ChunkResult>> futures = new ArrayList<>();
    for (DocumentChunk chunk : chunks) {
        futures.add(chunkExecutor.submit(() -> {
            if (isCancellationRequested(job.getId())) {
                return ChunkResult.cancelled();
            }
            return processSingleChunk(job, chunk, generator);
        }));
    }

    for (Future<ChunkResult> future : futures) {
        try {
            ChunkResult chunkResult = future.get();
            if (chunkResult.cancelled) {
                result.cancelled = true;
                break;
            }
            result.completedChunks++;
            result.failedChunks += chunkResult.failed ? 1 : 0;
            result.createdCandidates += chunkResult.createdCandidates;
            result.usage = result.usage.plus(chunkResult.usage);
            if (chunkResult.error != null) {
                result.errors.add(chunkResult.error);
            }
        } catch (ExecutionException ex) {
            result.failedChunks++;
            log.warn("Chunk processing failed", ex.getCause());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            result.cancelled = true;
            break;
        }
    }
    chunkExecutor.shutdownNow();
    return result;
}

private ChunkResult processSingleChunk(DocumentQuestionJob job, DocumentChunk chunk,
                                         DocumentQuestionGenerator generator) {
    long chunkStarted = System.nanoTime();
    try {
        List<String> qualityFlags = parseQualityFlags(chunk.getQualityFlags());
        if (!DocumentChunkQualityRules.isGenerationEligible(qualityFlags)) {
            return ChunkResult.skipped();
        }

        // Idempotency check
        String firstKey = generationKeyService.candidateKey(
            generator.provider(), generationProperties.getModel(),
            generationProperties.getPromptVersion(), job.getQuestionsPerChunk(),
            chunk.getTextHash(), "vi", 0);
        if (candidateRepository.findFirstByGenerationKeyAndStatusIn(firstKey, IDEMPOTENT_STATUSES).isPresent()) {
            return ChunkResult.skipped();
        }

        // Generate
        long generatorStarted = System.nanoTime();
        GeneratedChunkResult generated = generator.generate(new GenerationInput(
            job.getDocument().getId(), job.getId(), chunk.getId(),
            chunk.getText(), chunk.getSectionPath(),
            job.getQuestionsPerChunk(), "vi"));
        long generatorMs = elapsedMs(generatorStarted);

        // Persist
        persistKnowledgePoints(job, chunk, generated.knowledgePoints());
        CandidatePersistResult persistResult = persistCandidates(job, chunk, generated.questions(), generator.provider());

        return ChunkResult.success(generated.usage(), persistResult.createdCount());
    } catch (Exception ex) {
        return ChunkResult.failed(chunk, ex);
    }
}
```

### Lưu ý về transaction:

`processSingleChunk` gọi `persistCandidates` và `persistKnowledgePoints` — cần `@Transactional(propagation = REQUIRES_NEW)` cho từng chunk hoặc self-injection:

```java
// Trong DocumentQuestionJobService:
@Transactional(propagation = Propagation.REQUIRES_NEW)
public ChunkResult processSingleChunkTransactional(DocumentQuestionJob job,
                                                     DocumentChunk chunk,
                                                     DocumentQuestionGenerator generator) {
    return processSingleChunk(job, chunk, generator);
}
```

---

## 2.3 Batch Duplicate Check

### Hiện trạng (lines 319-401):

```java
for (int i = 0; i < questions.size(); i++) {
    // ...
    DuplicateCheckResult duplicate = duplicateCheckService.check(question.stem());
    // Mỗi candidate gọi duplicate check riêng → embedCandidateStem() gọi ONNX riêng
    // ...
}
```

### Vấn đề:
- Mỗi candidate gọi `embedCandidateStem()` → 1 ONNX inference riêng
- Với 8 candidates/chunk × 20 chunks = 160 ONNX calls (lãng phí)

### Fix — Embed trước, check sau:

```java
private CandidatePersistResult persistCandidates(
        DocumentQuestionJob job, DocumentChunk chunk,
        List<GeneratedQuestion> questions, String provider) {
    int created = 0;
    long duplicateCheckMs = 0;

    // 1. Pre-compute embeddings cho TẤT CẢ candidates trong chunk
    List<String> stems = questions.stream().map(GeneratedQuestion::stem).toList();
    List<double[]> candidateVectors = new ArrayList<>();
    long embedStart = System.nanoTime();
    for (String stem : stems) {
        try {
            candidateVectors.add(duplicateCheckService.embedCandidateStem(stem));
        } catch (Exception ex) {
            candidateVectors.add(null);  // Fallback: sẽ dùng lexical
        }
    }
    long embedMs = elapsedMs(embedStart);

    // 2. Load approved embeddings 1 lần
    List<QuestionEmbeddingSnapshot> approvedEmbeddings =
        duplicateCheckService.getApprovedEmbeddings();

    // 3. Check từng candidate với pre-computed vectors
    for (int i = 0; i < questions.size(); i++) {
        GeneratedQuestion question = questions.get(i);
        // ... idempotency check ...

        long duplicateStarted = System.nanoTime();
        DuplicateCheckResult duplicate;
        if (candidateVectors.get(i) != null) {
            duplicate = duplicateCheckService.semanticCheckWithVector(
                candidateVectors.get(i), approvedEmbeddings, Set.of(), Set.of());
        } else {
            duplicate = duplicateCheckService.lexicalCheck(question.stem(), Set.of(), Set.of());
        }
        duplicateCheckMs += elapsedMs(duplicateStarted);
        // ... persist ...
    }
    return new CandidatePersistResult(created, duplicateCheckMs, 0);
}
```

---

## 2.4 Cache Cancellation Status

### Hiện trạng (line 433-435):

```java
private boolean isCancellationRequested(Long jobId) {
    return jobRepository.findStatusByIdOrNull(jobId) == JobStatus.CANCELLED;
    // ← QUERY DB MỖI LẦN, mỗi chunk!
}
```

### Fix — Cache với TTL ngắn:

```java
private final Map<Long, CachedCancellation> cancellationCache = new ConcurrentHashMap<>();

private record CachedCancellation(boolean cancelled, long timestamp) {}

private static final long CACHE_TTL_MS = 5_000;  // 5s

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
```

Cần invalidate cache khi job bị cancel:

```java
@Transactional
public DocumentQuestionJobResponse cancel(Long jobId) {
    // ...
    cancellationCache.put(jobId, new CachedCancellation(true, System.currentTimeMillis()));
    // ...
}
```

---

## 2.5 Config

**File: `AiGenerationProperties.java`**

```java
private boolean parallelChunkProcessing = true;  // Feature flag
private int chunkParallelism = -1;  // -1 = dùng maxConcurrentCalls
```

**File: `application.yaml`**

```yaml
ai:
  generation:
    parallel-chunk-processing: ${GENERATION_PARALLEL_CHUNKS:true}
    chunk-parallelism: ${GENERATION_CHUNK_PARALLELISM:-1}
```

---

## 2.6 Files cần sửa

| File | Thay đổi |
|---|---|
| `DocumentQuestionJobService.java` | Parallel chunk processing, batch dedup, cache cancellation |
| `DuplicateCheckService.java` | Thêm `semanticCheckWithVector()`, `embedCandidateStem()` public |
| `AiGenerationProperties.java` | Thêm `parallelChunkProcessing`, `chunkParallelism` |
| `application.yaml` | Thêm config |

---

## 2.7 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| 20 chunks (single_call, 2 concurrent) | ~100s | **~50s** |
| 20 chunks (single_call, 4 concurrent) | ~100s | **~25s** |
| Duplicate check (8 candidates) | 8× embedding calls | **1× batch load + 8× cosine** |
| Cancellation check | DB query mỗi chunk | Cache 5s TTL |
| Transaction per chunk | 1 transaction lớn | N transactions nhỏ (an toàn hơn) |

---

## 2.8 Risk assessment

- **Parallel transaction**: Mỗi chunk cần transaction riêng (`REQUIRES_NEW`) để tránh rollback toàn bộ khi 1 chunk fail
- **Thread safety của repositories**: Spring Data JPA repositories thường thread-safe, nhưng cần verify với EntityManager
- **Duplicate check consistency**: Khi chạy parallel, 2 chunk có thể tạo candidate trùng lặp với nhau. Giải quyết bằng unique constraint trên `generation_key`
- **Memory**: Parallel chunks + batch vectors → memory tăng nhẹ, bounded bởi parallelism
