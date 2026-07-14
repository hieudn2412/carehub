# Phase 2: In-memory Cache & Tối ưu Vector Storage

> **Mục tiêu:** Loại bỏ chi phí DB query + JSON parse mỗi lần duplicate check
> **Độ phức tạp:** Trung bình | **Risk:** Thấp | **Kỳ vọng:** Nhanh hơn 3-5x cho mỗi lần dedup

---

## 2.1 Hiện trạng — Mỗi lần check đều query DB + parse JSON

### Flow hiện tại mỗi khi duplicate check:

```
1. Gọi DuplicateCheckService.check(stem)
2.   → QuestionEmbeddingService.approvedStemEmbeddings()
3.     → Repository.findTop500ByTextType...()          ← DB query (chậm)
4.     → Stream.map(embedding → new Snapshot(
5.         embedding.getQuestion().getId(),             ← Lazy load question
6.         embedding.getQuestion().getStem(),           ← Lazy load stem
7.         fromJson(embedding.getVectorJson())          ← JSON parse (chậm)
8.       ))
9.   → Loop qua tất cả embeddings, tính cosine         ← O(n×d) compute
```

### Chi phí mỗi lần duplicate check:

| Bước | Chi phí (ước tính) | % tổng |
|---|---|---|
| DB query (JOIN question, 500 rows) | ~3-5ms | 25% |
| JSON parse `vectorJson` (500×) | ~5-10ms | 50% |
| Cosine compute (500 × 384 dims) | ~1-2ms | 15% |
| Object allocation (Snapshot × 500) | ~1-2ms | 10% |

**Tổng: ~10-20ms cho 500 embeddings** — phần lớn là DB + JSON parse!

---

## 2.2 Giải pháp 1: In-memory Caffeine Cache

### Kiến trúc

```
┌─────────────────────────────────────────────────┐
│              DuplicateCheckService               │
│  check(stem) {                                   │
│    embeddings = cache.get("approved_stems");     │
│    // ... cosine loop ...                        │
│  }                                                │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│         EmbeddingCache (Caffeine)                │
│  - Key: "approved_stems"                        │
│  - Value: List<QuestionEmbeddingSnapshot>       │
│  - Refresh: on question saved/approved/rejected  │
│  - TTL: infinite (manual invalidation)           │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│    QuestionEmbeddingService                      │
│  saveStemEmbedding(question) → cache.invalidate()│
│  refreshStemEmbedding(question) → invalidate()   │
└─────────────────────────────────────────────────┘
```

### Implementation

**File mới: `embedding/EmbeddingCache.java`**

```java
package vn.vietduc.carehubbackend.questiongeneration.embedding;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.time.Duration;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmbeddingCache {
    private static final String APPROVED_STEMS_KEY = "approved_stems";

    private final QuestionEmbeddingService embeddingService;
    private final AiEmbeddingProperties properties;

    private volatile LoadingCache<String, List<QuestionEmbeddingSnapshot>> cache;

    @PostConstruct
    void init() {
        if (!properties.isE5Provider()) return;

        this.cache = Caffeine.newBuilder()
                .maximumSize(5)
                .expireAfterWrite(Duration.ofMinutes(properties.getCacheTtlMinutes()))
                .recordStats()
                .build(key -> {
                    log.info("Loading all approved stem embeddings into cache");
                    return embeddingService.loadAllApprovedStemEmbeddings();
                });
        log.info("Embedding cache initialized");
    }

    public List<QuestionEmbeddingSnapshot> approvedStemEmbeddings() {
        if (cache == null) {
            // Fallback nếu cache chưa init (E5 provider chưa sẵn sàng)
            return embeddingService.loadAllApprovedStemEmbeddings();
        }
        return cache.get(APPROVED_STEMS_KEY);
    }

    /**
     * Invalidate cache khi có thay đổi trong ngân hàng câu hỏi.
     * Gọi từ QuestionEmbeddingService hoặc QuestionBankService.
     */
    public void invalidate() {
        if (cache != null) {
            cache.invalidateAll();
            log.info("Embedding cache invalidated");
        }
    }

    /**
     * Số lượng embedding đang cache.
     */
    public int cachedCount() {
        if (cache == null) return 0;
        List<QuestionEmbeddingSnapshot> cached = cache.getIfPresent(APPROVED_STEMS_KEY);
        return cached == null ? 0 : cached.size();
    }
}
```

### Cập nhật `DuplicateCheckService` — dùng cache:

```java
// Trước:
List<QuestionEmbeddingSnapshot> embeddings = questionEmbeddingService.approvedStemEmbeddings();

// Sau:
List<QuestionEmbeddingSnapshot> embeddings = embeddingCache.approvedStemEmbeddings();
```

### Cache invalidation triggers:

**File: `QuestionEmbeddingService.java`** — Thêm invalidation:

```java
private final EmbeddingCache embeddingCache;  // Inject

@Transactional
public void saveStemEmbedding(QuestionBankQuestion question) {
    // ... persist embedding ...
    embeddingCache.invalidate();  // ← Invalidate cache
}

@Transactional
public void refreshStemEmbedding(QuestionBankQuestion question) {
    // ... delete + re-save ...
    embeddingCache.invalidate();  // ← Invalidate cache
}
```

**File: `QuestionBankService.java`** — Khi approve/reject/delete question:

```java
// Khi status thay đổi → ảnh hưởng đến approved embeddings
@Transactional
public void updateStatus(Long questionId, QuestionBankStatus newStatus) {
    // ... update status ...
    if (newStatus == QuestionBankStatus.APPROVED || oldStatus == QuestionBankStatus.APPROVED) {
        embeddingCache.invalidate();
    }
}
```

---

## 2.3 Giải pháp 2: Đổi vector storage — JSON → FLOAT8[]

### Hiện trạng

```java
// QuestionEmbedding.java (line 51)
@Column(nullable = false, columnDefinition = "text")
private String vectorJson;  // "[0.123, -0.456, 0.789, ...]" — ~3000 chars!
```

### Vấn đề:
- **Storage**: 384 doubles dạng text → ~3000-4000 bytes. Dạng binary → 384 × 8 = 3072 bytes (tương đương). Nhưng parsing overhead lớn.
- **CPU**: `ObjectMapper.readValue(json, double[].class)` mỗi lần đọc — parse 3000 chars
- **Không index được**: PostgreSQL không thể dùng `vectorJson` cho similarity search

### Giải pháp: Dùng PostgreSQL `double precision[]` (FLOAT8[])

```sql
-- Migration:
ALTER TABLE question_embeddings
  ADD COLUMN IF NOT EXISTS vector double precision[];

-- Copy data từ vectorJson sang vector (migration script Java/Kotlin)
-- Sau khi copy xong:
-- ALTER TABLE question_embeddings DROP COLUMN vector_json;
```

**File: `QuestionEmbedding.java`** — Entity mới:

```java
// Cũ:
// @Column(nullable = false, columnDefinition = "text")
// private String vectorJson;

// Mới: Dùng PostgreSQL array
@Column(nullable = false, columnDefinition = "double precision[]")
private double[] vector;  // Được map tự động bởi Hibernate 6 + hypersistence-utils

// Giữ normalized_text để debug/log (optional)
@Column(name = "normalized_text", nullable = false, columnDefinition = "text")
private String normalizedText;
```

### Migration strategy:

```java
// Migration service — chạy 1 lần khi deploy
@Transactional
public void migrateVectorJsonToArray() {
    List<QuestionEmbedding> all = embeddingRepository.findAll();
    for (QuestionEmbedding embedding : all) {
        if (embedding.getVectorJson() != null && embedding.getVector() == null) {
            double[] vector = objectMapper.readValue(embedding.getVectorJson(), double[].class);
            embedding.setVector(vector);
            embeddingRepository.save(embedding);
        }
    }
}
```

**Lưu ý:** Cần thêm dependency `io.hypersistence:hypersistence-utils-hibernate-63` để Hibernate map `double[]` ↔ PostgreSQL `float8[]`.

### Hoặc: Dùng kiểu `bytea` (binary) nếu không muốn thêm dependency:

```java
@Column(nullable = false, columnDefinition = "bytea")
private byte[] vectorBytes;

// Convert:
public static byte[] toBytes(double[] vector) {
    ByteBuffer buffer = ByteBuffer.allocate(vector.length * Double.BYTES);
    buffer.order(ByteOrder.nativeOrder());
    for (double v : vector) buffer.putDouble(v);
    return buffer.array();
}

public static double[] fromBytes(byte[] bytes) {
    ByteBuffer buffer = ByteBuffer.wrap(bytes);
    buffer.order(ByteOrder.nativeOrder());
    double[] vector = new double[bytes.length / Double.BYTES];
    for (int i = 0; i < vector.length; i++) vector[i] = buffer.getDouble();
    return vector;
}
```

---

## 2.4 Startup warmup cache

**File: `EmbeddingCache.java`** — Thêm listener:

```java
@Component
@RequiredArgsConstructor
public class EmbeddingCacheWarmup {
    private final EmbeddingCache cache;
    private final AiEmbeddingProperties properties;

    @EventListener(ApplicationReadyEvent.class)
    public void warmupAfterStartup() {
        if (!properties.isE5Provider() || !properties.isCacheWarmupEnabled()) {
            return;
        }
        try {
            int count = cache.approvedStemEmbeddings().size();
            log.info("Embedding cache warmed up with {} embeddings", count);
        } catch (RuntimeException ex) {
            log.warn("Không warmup được embedding cache: {}", ex.getMessage());
        }
    }
}
```

---

## 2.5 Config

**File: `AiEmbeddingProperties.java`**

```java
private int cacheTtlMinutes = 30;        // TTL cache (refresh định kỳ)
private boolean cacheWarmupEnabled = true; // Warmup cache khi startup
```

**File: `application.yaml`**

```yaml
ai:
  embedding:
    cache-ttl-minutes: ${E5_CACHE_TTL_MINUTES:30}
    cache-warmup-enabled: ${E5_CACHE_WARMUP_ENABLED:true}
```

---

## 2.6 Files cần sửa

| File | Thay đổi |
|---|---|
| `embedding/EmbeddingCache.java` | **File mới** — Caffeine cache |
| `embedding/EmbeddingCacheWarmup.java` | **File mới** — Warmup listener |
| `QuestionEmbeddingService.java` | Thêm `loadAllApprovedStemEmbeddings()`, cache invalidation |
| `DuplicateCheckService.java` | Dùng `EmbeddingCache` thay vì service trực tiếp |
| `QuestionEmbedding.java` | Đổi `vectorJson` (TEXT) → `vector` (FLOAT8[]) |
| `AiEmbeddingProperties.java` | Thêm `cacheTtlMinutes`, `cacheWarmupEnabled` |
| `application.yaml` | Thêm config cache |
| Migration SQL | `ALTER TABLE` thêm cột `vector`, migrate data |
| `build.gradle` / `pom.xml` | Thêm Caffeine + hypersistence-utils dependency |

---

## 2.7 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| DB query / dedup | 1 query (3-5ms) | **0 query** (cache hit) |
| JSON parse / dedup | 500× parse (~5-10ms) | **0 parse** (đã deserialize sẵn) |
| Tổng latency dedup (500 câu) | ~10-20ms | **~1-2ms** (chỉ cosine compute) |
| Storage / embedding | ~3KB (JSON text) | ~3KB (float8[]) hoặc ~3KB (bytea) |
| Memory (cache 500 câu) | 0 | ~15MB (chấp nhận được) |
| Memory (cache 5000 câu) | 0 | ~150MB (vẫn ổn) |

---

## 2.8 Risk assessment

- **Cache staleness**: Nếu quên invalidate cache khi thay đổi → duplicate check dùng data cũ. Giải quyết bằng TTL + manual invalidation ở tất cả các điểm thay đổi
- **Migration rủi ro**: Cần test kỹ migration từ `vectorJson` → `vector[]`. Giữ cả 2 column trong giai đoạn transition
- **Hibernate array mapping**: Cần hypersistence-utils hoặc custom UserType. Test với mọi DB operation (insert, update, select)
- **Memory usage**: Với 10,000 câu × 384 dims × 8 bytes = ~30MB — vẫn ổn. Nếu vượt quá, có thể dùng off-heap hoặc disk-backed cache
