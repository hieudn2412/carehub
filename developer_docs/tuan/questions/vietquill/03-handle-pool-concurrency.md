# Phase 3: Loại bỏ bottleneck `synchronized` — Handle Pool

> **Mục tiêu:** Cho phép nhiều request paraphrase chạy đồng thời thay vì xếp hàng tuần tự
> **Độ phức tạp:** Trung bình | **Risk:** Trung bình | **Kỳ vọng cải thiện:** Throughput tăng Nx (N = pool size)

---

## 3.1 Hiện trạng — Single-handle, global lock

### File: `VietQuillParaphraseModelService.java`

```java
private volatile RuntimeHandle runtime;  // ← CHỈ 1 handle cho toàn bộ app

private String generate(Seq2SeqHandle handle, String prompt, int variantIndex) {
    synchronized (handle) {  // ← Lock global, chỉ 1 thread được chạy
        Encoding encoding = handle.tokenizer().encode(prompt);
        // ... encode + beamDecode ...
    }
}
```

### Vấn đề:
- **1 ONNX session** → ONNX Runtime không thread-safe khi chạy inference
- `synchronized (handle)` → chỉ 1 thread được dùng `Seq2SeqHandle` tại 1 thời điểm
- Nếu User A đang paraphrase (mất 5-10s), User B phải đợi đến khi A xong
- Không scale được khi nhiều user dùng đồng thời

---

## 3.2 Giải pháp: Object Pool các Seq2SeqHandle

### Kiến trúc

```
                   ┌──────────────────────────┐
                   │   Paraphrase Request 1    │
                   │   Paraphrase Request 2    │
                   │   Paraphrase Request 3    │
                   └──────────┬───────────────┘
                              │
                   ┌──────────▼───────────────┐
                   │    HandlePool (size=N)    │
                   │  ┌─────────────────────┐  │
                   │  │ Seq2SeqHandle[0]    │  │
                   │  │  - encoder session   │  │
                   │  │  - decoder session   │  │
                   │  │  - tokenizer         │  │
                   │  ├─────────────────────┤  │
                   │  │ Seq2SeqHandle[1]    │  │
                   │  │  - encoder session   │  │
                   │  │  - decoder session   │  │
                   │  │  - tokenizer         │  │
                   │  ├─────────────────────┤  │
                   │  │ Seq2SeqHandle[2]    │  │
                   │  │  - ...              │  │
                   │  └─────────────────────┘  │
                   └──────────────────────────┘
```

Mỗi handle có ONNX session riêng → thread-safe vì mỗi thread dùng session riêng.

### Chi phí bộ nhớ:
- Mỗi ONNX session cho T5-small: ~200-400MB RAM
- Pool size = 2-3 → ~600MB-1.2GB (chấp nhận được cho server)
- Có thể config pool size theo RAM available

---

## 3.3 Implementation

### 3.3.1 Tạo `VietQuillHandlePool` class mới

**File mới: `modelruntime/vietquill/VietQuillHandlePool.java`**

```java
package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtSession;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;

import java.nio.file.Path;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class VietQuillHandlePool {
    private final BlockingQueue<Seq2SeqHandle> available;
    private final Seq2SeqHandle[] allHandles;
    private final int poolSize;

    public VietQuillHandlePool(AiParaphraseProperties properties) {
        this.poolSize = Math.max(1, properties.getPoolSize());
        this.available = new ArrayBlockingQueue<>(poolSize);
        this.allHandles = new Seq2SeqHandle[poolSize];
    }

    /**
     * Khởi tạo tất cả handles trong pool.
     * Gọi từ VietQuillParaphraseModelService sau khi loadRuntime thành công.
     */
    public void initialize(HandleFactory factory) {
        for (int i = 0; i < poolSize; i++) {
            allHandles[i] = factory.create(i);
            available.offer(allHandles[i]);
        }
        log.info("VietQuill handle pool initialized with {} handles", poolSize);
    }

    /**
     * Lấy 1 handle từ pool. Block tối đa acquireTimeoutMs.
     */
    public Seq2SeqHandle acquire(long timeoutMs) throws InterruptedException {
        Seq2SeqHandle handle = available.poll(timeoutMs, TimeUnit.MILLISECONDS);
        if (handle == null) {
            throw new IllegalStateException(
                "Không có VietQuill handle nào khả dụng sau " + timeoutMs + "ms. " +
                "Pool size=" + poolSize + ", hãy tăng VIETQUILL_POOL_SIZE hoặc thử lại sau.");
        }
        return handle;
    }

    /**
     * Trả handle về pool sau khi dùng xong.
     */
    public void release(Seq2SeqHandle handle) {
        if (handle != null) {
            available.offer(handle);
        }
    }

    @PreDestroy
    public void close() {
        for (Seq2SeqHandle handle : allHandles) {
            if (handle != null) {
                try { handle.close(); } catch (Exception ignored) {}
            }
        }
        log.info("VietQuill handle pool closed ({} handles)", poolSize);
    }

    public int poolSize() {
        return poolSize;
    }

    @FunctionalInterface
    public interface HandleFactory {
        Seq2SeqHandle create(int index);
    }
}
```

### 3.3.2 Cập nhật `VietQuillParaphraseModelService`

**Thay đổi chính:**

```java
@Slf4j
@Service
@RequiredArgsConstructor
public class VietQuillParaphraseModelService implements ParaphraseModelService {
    private final VietQuillPromptBuilder promptBuilder;
    private final VietQuillMcqParser mcqParser;
    private VietQuillHandlePool handlePool;  // ← Thay vì volatile RuntimeHandle runtime

    private volatile boolean initialized = false;

    @PostConstruct
    void preload() {
        if (!properties.isVietQuillProvider() || !properties.isPreload()) {
            return;
        }
        try {
            ensureInitialized();
            warmup();
        } catch (RuntimeException ex) {
            log.warn("Không preload được VietQuill model: {}", ex.getMessage());
        }
    }

    private synchronized void ensureInitialized() {
        if (initialized) return;

        this.handlePool = new VietQuillHandlePool(properties);
        this.handlePool.initialize(index -> {
            log.info("Loading VietQuill handle {}/{}", index + 1, properties.getPoolSize());
            return loadSingleHandle();
        });
        initialized = true;
    }

    private Seq2SeqHandle loadSingleHandle() {
        // Logic từ loadRuntime() hiện tại, nhưng tạo Seq2SeqHandle riêng cho mỗi pool slot
        // Mỗi handle có OrtSession encoder + decoder riêng
        // ...
    }

    @Override
    public List<ParaphrasedMcq> paraphrase(ParaphraseModelInput input) {
        // ... validation ...
        ensureInitialized();

        Seq2SeqHandle handle = null;
        try {
            handle = handlePool.acquire(properties.getAcquireTimeoutMs());
            return doParaphrase(handle, input);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ParaphraseModelException("Bị ngắt khi chờ VietQuill handle", ex);
        } finally {
            handlePool.release(handle);
        }
    }

    private List<ParaphrasedMcq> doParaphrase(Seq2SeqHandle handle, ParaphraseModelInput input) {
        int count = Math.max(1, Math.min(10, input.requestedCount()));
        List<ParaphrasedMcq> results = new ArrayList<>();

        for (int index = 0; index < count; index++) {
            if (properties.isSinglePassEnabled()) {
                // Single-pass generation (Phase 2)
                String prompt = promptBuilder.buildFullMcq(input);
                String rawOutput = generate(handle, prompt, index);
                ParaphrasedMcq mcq = mcqParser.parseFullMcq(rawOutput);
                results.add(enrich(mcq, input));
            } else {
                // Per-field generation (logic cũ)
                String stem = generate(handle, input.stem(), index);
                // ...
            }
        }
        return results;
    }

    private String generate(Seq2SeqHandle handle, String prompt, int variantIndex) {
        // ← KHÔNG còn synchronized nữa!
        // Mỗi thread có handle riêng → thread-safe
        Encoding encoding = handle.tokenizer().encode(prompt);
        // ... (giữ nguyên logic encode + beamDecode)
    }

    @PreDestroy
    void close() {
        if (handlePool != null) {
            handlePool.close();
        }
    }
}
```

### 3.3.3 Cập nhật config

**File: `AiParaphraseProperties.java`**
```java
private int poolSize = 2;                // Số lượng ONNX session trong pool
private long acquireTimeoutMs = 30_000;  // Timeout chờ acquire handle (30s)
```

**File: `application.yaml`**
```yaml
ai:
  paraphrase:
    pool-size: ${VIETQUILL_POOL_SIZE:2}
    acquire-timeout-ms: ${VIETQUILL_ACQUIRE_TIMEOUT_MS:30000}
```

---

## 3.4 Memory Planning

| Pool Size | RAM sử dụng (ước tính) | Concurrent requests |
|---|---|---|
| 1 (hiện tại) | ~300-400MB | 1 |
| 2 (mặc định mới) | ~600-800MB | 2 |
| 3 | ~900MB-1.2GB | 3 |

**Lưu ý:** Tokenizer (`HuggingFaceTokenizer`) dùng chung được giữa các handle vì nó stateless. Có thể tối ưu thêm bằng cách share 1 tokenizer instance.

---

## 3.5 Files cần sửa

| File | Thay đổi |
|---|---|
| `VietQuillHandlePool.java` | **File mới** — BlockingQueue pool |
| `VietQuillParaphraseModelService.java` | Thay `volatile RuntimeHandle` = `HandlePool`, bỏ `synchronized` |
| `AiParaphraseProperties.java` | Thêm `poolSize`, `acquireTimeoutMs` |
| `application.yaml` | Thêm config cho pool |

---

## 3.6 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| Concurrent requests | 1 (tuần tự) | N (pool size) |
| Throughput | ~6-12 req/min | ~(6-12) × N req/min |
| RAM | ~400MB | ~400MB × N |
| Response time khi có queue | Tăng tuyến tính | Ổn định (miễn là pool còn slot) |

---

## 3.7 Risk assessment

- **Tăng RAM**: Cần verify server có đủ RAM. Với Spring Boot + PostgreSQL + Redis + 2 ONNX sessions, cần tối thiểu 2-3GB RAM
- **ONNX Runtime thread safety**: Mỗi session phải được dùng bởi đúng 1 thread tại 1 thời điểm. Pool pattern đảm bảo điều này
- **Tokenizer sharing**: Nếu share tokenizer, cần verify HuggingFaceTokenizer thread-safety. DJL docs nói tokenizer là thread-safe sau khi loaded
- **Warmup cho tất cả handles**: Mỗi handle cần inference warmup riêng (JIT per session)
