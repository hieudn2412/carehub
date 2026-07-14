# Phase 4: Batch Inference & Async Backfill

> **Mục tiêu:** Giảm thời gian backfill embedding bằng batch ONNX inference + chạy bất đồng bộ
> **Độ phức tạp:** Trung bình | **Risk:** Trung bình | **Kỳ vọng:** Backfill nhanh hơn 5-10x, không block startup

---

## 4.1 Hiện trạng — Backfill tuần tự, block startup

### File: `QuestionEmbeddingService.java` (lines 88-110)

```java
public BackfillResult backfillApprovedQuestionEmbeddings() {
    int created = 0, skipped = 0, failed = 0;
    if (!properties.isE5Provider()) return new BackfillResult(0, 0, 0);

    List<QuestionBankQuestion> questions = questionRepository.findByStatusOrderByIdAsc(QuestionBankStatus.APPROVED);
    // ← Load TẤT CẢ approved questions vào memory!

    for (QuestionBankQuestion question : questions) {  // ← Tuần tự từng câu!
        try {
            PersistResult result = persistStemEmbedding(question);
            if (result == PersistResult.CREATED) created++;
            else skipped++;
        } catch (RuntimeException ex) {
            failed++;
        }
    }
    return new BackfillResult(created, skipped, failed);
}
```

### File: `QuestionEmbeddingStartupBackfill.java` (lines 17-33)

```java
@EventListener(ApplicationReadyEvent.class)  // ← Block ApplicationReady!
public void backfillAfterStartup(ApplicationReadyEvent event) {
    if (!properties.isE5Provider() || !properties.isBackfillOnStartup()) {
        return;
    }
    try {
        BackfillResult result = embeddingService.backfillApprovedQuestionEmbeddings();
        // ← Đồng bộ, block startup cho đến khi backfill xong!
        log.info("Question bank E5 embedding backfill completed: created={}, skipped={}, failed={}",
                result.created(), result.skipped(), result.failed());
    } catch (RuntimeException ex) {
        log.warn("Không backfill được E5 embedding cho ngân hàng câu hỏi: {}", ex.getMessage());
    }
}
```

### Vấn đề:

1. **Block ApplicationReady**: Backfill chạy đồng bộ trong `ApplicationReadyEvent` listener → delay application readiness
2. **Tuần tự từng câu**: Mỗi câu 1 ONNX inference (encode → ONNX run → close tensors) — không tận dụng batch
3. **Load toàn bộ question vào memory**: `findByStatusOrderByIdAsc` load tất cả approved questions → memory spike
4. **Không incremental**: Mỗi lần chạy lại backfill tất cả, kể cả những câu đã có embedding
5. **Mỗi lần inference tạo/xóa ONNX tensor**: Object allocation overhead lớn

---

## 4.2 Giải pháp 1: Batch ONNX Inference

### Ý tưởng
Thay vì gọi `embedPassage()` cho từng câu, gộp N câu vào 1 batch ONNX call.

### Cần sửa `EmbeddingModelService` interface:

**File: `EmbeddingModelService.java`**

```java
public interface EmbeddingModelService {
    String modelName();

    /** Single embedding (giữ lại cho real-time dedup check) */
    double[] embedQuery(String text);

    /** Single embedding (giữ lại cho backfill từng câu) */
    double[] embedPassage(String text);

    /** Batch embedding (mới — cho backfill) */
    List<double[]> embedPassageBatch(List<String> texts);

    /** Batch embedding với progress callback */
    List<double[]> embedPassageBatch(List<String> texts, Consumer<Integer> progressCallback);
}
```

### Implementation trong `E5EmbeddingModelService`:

**File: `E5EmbeddingModelService.java`**

```java
@Override
public List<double[]> embedPassageBatch(List<String> texts) {
    return embedPassageBatch(texts, null);
}

@Override
public List<double[]> embedPassageBatch(List<String> texts, Consumer<Integer> progressCallback) {
    if (texts == null || texts.isEmpty()) return List.of();

    RuntimeHandle handle = ensureRuntime();
    int batchSize = Math.max(1, Math.min(properties.getBatchSize(), texts.size()));
    List<double[]> results = new ArrayList<>(texts.size());

    for (int offset = 0; offset < texts.size(); offset += batchSize) {
        int end = Math.min(offset + batchSize, texts.size());
        List<String> batch = texts.subList(offset, end);

        // Tokenize tất cả texts trong batch
        List<long[]> batchInputIds = new ArrayList<>(batch.size());
        List<long[]> batchAttentionMasks = new ArrayList<>(batch.size());
        int maxSeqLen = 0;

        for (String text : batch) {
            String prepared = E5TextPreprocessor.passage(text);
            Encoding encoding = handle.tokenizer().encode(prepared);
            long[] inputIds = truncate(encoding.getIds());
            long[] attentionMask = truncate(encoding.getAttentionMask());
            if (attentionMask.length != inputIds.length) {
                attentionMask = filled(inputIds.length, 1);
            }
            maxSeqLen = Math.max(maxSeqLen, inputIds.length);
            batchInputIds.add(inputIds);
            batchAttentionMasks.add(attentionMask);
        }

        // Pad tất cả sequences về cùng length
        long[][] paddedInputIds = new long[batch.size()][maxSeqLen];
        long[][] paddedAttentionMask = new long[batch.size()][maxSeqLen];
        for (int i = 0; i < batch.size(); i++) {
            System.arraycopy(batchInputIds.get(i), 0, paddedInputIds[i], 0, batchInputIds.get(i).length);
            System.arraycopy(batchAttentionMasks.get(i), 0, paddedAttentionMask[i], 0, batchAttentionMasks.get(i).length);
        }

        // Batch ONNX inference
        Map<String, OnnxTensor> tensors = new LinkedHashMap<>();
        try {
            addTensorIfExpected(handle, tensors, "input_ids", paddedInputIds);
            addTensorIfExpected(handle, tensors, "attention_mask", paddedAttentionMask);
            // token_type_ids nếu cần
            try (OrtSession.Result result = handle.session().run(tensors)) {
                Object value = result.get(0).getValue();
                List<double[]> batchResults = toBatchVectors(value, batchAttentionMasks);
                results.addAll(batchResults);
            }
        } catch (Exception ex) {
            throw new EmbeddingModelException("Không tạo được batch embedding E5", ex);
        } finally {
            OnnxValue.close(tensors.values());
        }

        if (progressCallback != null) {
            progressCallback.accept(end);
        }
    }
    return results;
}

// Helper: convert batch ONNX output → list of vectors
private List<double[]> toBatchVectors(Object value, List<long[]> attentionMasks) {
    // float[batch][seq_len][hidden_dim] → List<double[]>
    if (value instanceof float[][][] tokenEmbeddings) {
        List<double[]> result = new ArrayList<>();
        for (int b = 0; b < tokenEmbeddings.length; b++) {
            result.add(l2Normalize(meanPool(tokenEmbeddings[b], attentionMasks.get(b))));
        }
        return result;
    }
    // ... handle other types ...
}
```

### Config batch size:

**File: `AiEmbeddingProperties.java`**

```java
private int batchSize = 32;  // Batch size cho backfill/cache warmup
```

**File: `application.yaml`**

```yaml
ai:
  embedding:
    batch-size: ${E5_BATCH_SIZE:32}
```

---

## 4.3 Giải pháp 2: Async Backfill

### Implementation

**File: `QuestionEmbeddingStartupBackfill.java`**

```java
@Slf4j
@Component
@RequiredArgsConstructor
public class QuestionEmbeddingStartupBackfill {
    private final AiEmbeddingProperties properties;
    private final QuestionEmbeddingService embeddingService;
    private final EmbeddingCache embeddingCache;
    private final ThreadPoolTaskExecutor backfillExecutor;  // Bean riêng

    @EventListener(ApplicationReadyEvent.class)
    public void backfillAfterStartup(ApplicationReadyEvent event) {
        if (!properties.isE5Provider() || !properties.isBackfillOnStartup()) {
            return;
        }
        if (properties.isBackfillAsync()) {
            // Async — không block startup
            backfillExecutor.execute(() -> {
                try {
                    BackfillResult result = embeddingService.backfillApprovedQuestionEmbeddings();
                    log.info("Async E5 backfill completed: created={}, skipped={}, failed={}",
                        result.created(), result.skipped(), result.failed());
                    // Refresh cache sau khi backfill xong
                    embeddingCache.invalidate();
                } catch (RuntimeException ex) {
                    log.warn("Async E5 backfill failed: {}", ex.getMessage());
                }
            });
        } else {
            // Sync — block startup (legacy behavior)
            try {
                BackfillResult result = embeddingService.backfillApprovedQuestionEmbeddings();
                log.info("Sync E5 backfill completed: created={}, skipped={}, failed={}",
                    result.created(), result.skipped(), result.failed());
            } catch (RuntimeException ex) {
                log.warn("Sync E5 backfill failed: {}", ex.getMessage());
            }
        }
    }
}
```

### Config:

**File: `AiEmbeddingProperties.java`**

```java
private boolean backfillAsync = true;  // Async backfill mặc định
```

**File: `application.yaml`**

```yaml
ai:
  embedding:
    backfill-async: ${E5_BACKFILL_ASYNC:true}
```

### Backfill executor config:

**File: `config/EmbeddingAsyncConfig.java`**

```java
@Configuration
@EnableAsync
public class EmbeddingAsyncConfig {
    @Bean("backfillExecutor")
    public ThreadPoolTaskExecutor backfillExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(10);
        executor.setThreadNamePrefix("e5-backfill-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        return executor;
    }
}
```

---

## 4.4 Giải pháp 3: Incremental Backfill

Chỉ backfill những câu CHƯA có embedding (thay vì tất cả):

**File: `QuestionEmbeddingService.java`**

```java
public BackfillResult backfillApprovedQuestionEmbeddings() {
    int created = 0, skipped = 0, failed = 0;
    if (!properties.isE5Provider()) return new BackfillResult(0, 0, 0);

    List<QuestionBankQuestion> questions = questionRepository.findByStatusOrderByIdAsc(QuestionBankStatus.APPROVED);

    // Batch inference nếu enable
    if (properties.isBatchEnabled()) {
        return backfillWithBatch(questions);
    }
    return backfillSequential(questions);
}

private BackfillResult backfillWithBatch(List<QuestionBankQuestion> questions) {
    int created = 0, skipped = 0, failed = 0;

    // Lọc: chỉ giữ câu chưa có embedding (incremental)
    List<QuestionBankQuestion> pending = new ArrayList<>();
    for (QuestionBankQuestion q : questions) {
        String hash = sha256(E5TextPreprocessor.normalize(q.getStem()));
        boolean exists = embeddingRepository
            .findFirstByQuestionAndTextTypeAndEmbeddingModelAndInputTextHash(
                q, STEM_TEXT_TYPE, properties.getModel(), hash)
            .isPresent();
        if (exists) {
            skipped++;
        } else {
            pending.add(q);
        }
    }

    if (pending.isEmpty()) {
        return new BackfillResult(0, skipped, 0);
    }

    // Batch embed
    List<String> stems = pending.stream().map(QuestionBankQuestion::getStem).toList();
    List<double[]> vectors;
    try {
        vectors = embeddingModelService.embedPassageBatch(stems, progress -> {
            log.info("E5 batch backfill progress: {}/{} questions", progress, stems.size());
        });
    } catch (RuntimeException ex) {
        failed = pending.size();
        log.warn("E5 batch backfill failed: {}", ex.getMessage());
        return new BackfillResult(0, skipped, failed);
    }

    // Persist batch
    for (int i = 0; i < pending.size(); i++) {
        try {
            persistStemEmbeddingFromVector(pending.get(i), vectors.get(i));
            created++;
        } catch (RuntimeException ex) {
            failed++;
            log.warn("Không persist được embedding cho question {}: {}", pending.get(i).getId(), ex.getMessage());
        }
    }
    return new BackfillResult(created, skipped, failed);
}
```

---

## 4.5 ONNX Execution Provider Tuning

### Hiện trạng:
```java
OrtSession.SessionOptions options = new OrtSession.SessionOptions();
options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
```

### Tối ưu thêm:

```java
OrtSession.SessionOptions options = new OrtSession.SessionOptions();

// 1. Optimization level
options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);

// 2. Số thread cho intra-op parallelism
int numThreads = Math.max(1, Runtime.getRuntime().availableProcessors() - 1);
options.setIntraOpNumThreads(numThreads);
options.setInterOpNumThreads(1);  // 1 vì chúng ta tự quản lý concurrency qua pool

// 3. Graph optimization level
options.setGraphOptimizationLevel(OrtSession.SessionOptions.GraphOptLevel.ALL_OPT);

// 4. Enable memory pattern optimization
options.setExecutionMode(OrtSession.SessionOptions.ExecutionMode.SEQUENTIAL);

// 5. CPU Arena allocation (giảm fragmentation)
options.addConfig("session.intra_op.allow_spinning", "0");  // Tắt busy-waiting
options.addConfig("session.inter_op.allow_spinning", "0");

log.info("E5 ONNX session configured: intraOpThreads={}, optLevel=ALL_OPT", numThreads);
```

### Config:

**File: `AiEmbeddingProperties.java`**

```java
private int intraOpThreads = -1;  // -1 = auto-detect (CPU cores - 1)
private int interOpThreads = 1;
private String executionProvider = "CPU";  // CPU | CUDA (nếu có GPU)
```

---

## 4.6 Files cần sửa

| File | Thay đổi |
|---|---|
| `EmbeddingModelService.java` | Thêm `embedPassageBatch()` methods |
| `E5EmbeddingModelService.java` | Implement batch inference, ONNX tuning |
| `QuestionEmbeddingService.java` | Thêm `backfillWithBatch()`, incremental check |
| `QuestionEmbeddingStartupBackfill.java` | Async backfill support |
| `EmbeddingAsyncConfig.java` | **File mới** — Backfill executor bean |
| `AiEmbeddingProperties.java` | Thêm `batchSize`, `backfillAsync`, `batchEnabled`, ONNX thread config |
| `application.yaml` | Thêm config batch + async |

---

## 4.7 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| Backfill 1000 câu | ~30-60s (block startup) | **~3-5s (async, không block)** |
| Backfill 5000 câu | ~150-300s (block) | **~15-25s (async)** |
| Startup time impact | +delay backfill | **0 (async)** |
| Backfill redundant work | Backfill tất cả mỗi lần | **Chỉ câu mới (incremental)** |
| ONNX utilization | 1 sequence/batch | **32 sequences/batch** |
| Memory peak (backfill) | 1× model + 1× tokens | 1× model + 32× tokens (cao hơn, config được) |

---

## 4.8 Risk assessment

- **Batch padding waste**: Nếu các stem có độ dài khác nhau nhiều → padding tokens lãng phí compute. Giải quyết bằng dynamic batching (group theo length) hoặc sắp xếp trước khi batch
- **Async backfill race condition**: Có thể có request dedup trước khi backfill hoàn tất → cache chưa đầy đủ. Không nghiêm trọng (temporary), cache sẽ được refresh sau backfill
- **Batch OOM**: Với batch_size=32 và max_seq_len=512, tensor kích thước [32, 512, 384] = 25MB — chấp nhận được
- **ONNX thread tuning**: Quá nhiều intra-op threads có thể gây context switching overhead. Default (CPU cores - 1) thường là tối ưu
