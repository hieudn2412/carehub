# Phase 3: ANN Index (HNSW) — Sub-linear Dedup Search

> **Mục tiêu:** Giảm độ phức tạp dedup search từ O(n) → O(log n) bằng approximate nearest neighbor
> **Độ phức tạp:** Trung bình-Cao | **Risk:** Trung bình | **Kỳ vọng:** Nhanh hơn 10-50x với ngân hàng > 1000 câu

---

## 3.1 Hiện trạng — Linear scan O(n)

### File: `DuplicateCheckService.java` (lines 69-114)

```java
private DuplicateCheckResult semanticCheck(...) {
    double[] candidateVector = questionEmbeddingService.embedCandidateStem(stem);
    double best = 0;
    Long matchedId = null;
    String matchedStem = null;

    List<QuestionEmbeddingSnapshot> embeddings = ...; // Toàn bộ approved embeddings

    for (QuestionEmbeddingSnapshot embedding : embeddings) {  // ← O(n)!
        if (excludedQuestionIds.contains(embedding.questionId())) continue;
        double score = cosine(candidateVector, embedding.vector());
        if (score > best) {
            best = score;
            matchedId = embedding.questionId();
            matchedStem = embedding.stem();
        }
        // Có thể dừng sớm nếu tìm thấy strong duplicate?
        if (best >= properties.getDuplicate().getStrongMin()) {
            break;  // ← Đã implement chưa? Hiện tại là KHÔNG
        }
    }
    // ...
}
```

### Vấn đề:
- **O(n×d)** với n = số embedding, d = 384 dims
- 500 câu: ~200K float ops → 1-2ms — okay
- 5000 câu: ~2M float ops → 10-20ms — chậm
- 50000 câu: ~20M float ops → 100-200ms — không chấp nhận được
- **Chưa có early termination**: Không dừng sớm khi đã tìm thấy strong duplicate

---

## 3.2 Giải pháp: HNSW (Hierarchical Navigable Small World)

### Tại sao HNSW?

| Thuật toán | Search complexity | Build time | Memory | Accuracy |
|---|---|---|---|---|
| Linear scan | O(n×d) | 0 | n×d | 100% |
| LSH | O(k×d) | O(n×d×k) | n×k | ~90-95% |
| IVF + PQ | O(nlist×d) | O(n×d) | n×d | ~95-98% |
| **HNSW** | **O(log n × d)** | O(n×log n×d) | n×d×M | **~99%** |

HNSW phù hợp nhất vì:
- Accuracy cao (~99% recall so với exact search)
- Search rất nhanh (log-scale)
- Có Java implementation sẵn (Apache Lucene, hoặc tự implement)
- Memory overhead hợp lý (M edges per node, M=16 → ~16× tham chiếu)

### Cách hoạt động HNSW (tóm tắt):

```
Layer 2:  *-------*         (ít node, skip-list để jump nhanh)
          |       |
Layer 1:  *---*---*---*     (nhiều node hơn)
          |  /|  /|  /|
Layer 0:  *-*-*-*-*-*-*-*   (tất cả node, search chính xác)

Search: bắt đầu từ top layer, greedy search xuống dần
Insert: xác suất giảm dần theo layer (như skip-list)
```

---

## 3.3 Implementation — Sử dụng Apache Lucene HNSW

### 3.3.1 Dependency

```groovy
// build.gradle
implementation 'org.apache.lucene:lucene-core:9.12.0'
```

### 3.3.2 HNSW Index Wrapper

**File mới: `embedding/HnswEmbeddingIndex.java`**

```java
package vn.vietduc.carehubbackend.questiongeneration.embedding;

import lombok.extern.slf4j.Slf4j;
import org.apache.lucene.util.hnsw.HnswGraphBuilder;
import org.apache.lucene.util.hnsw.HnswGraphSearcher;
import org.apache.lucene.util.hnsw.NeighborArray;
import org.apache.lucene.util.hnsw.RandomVectorScorer;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Slf4j
@Component
public class HnswEmbeddingIndex {
    private final AtomicReference<List<IndexEntry>> entries = new AtomicReference<>(List.of());
    private final AtomicReference<HnswGraphBuilder<IndexEntry>> graph = new AtomicReference<>();
    private final ReadWriteLock rebuildLock = new ReentrantReadWriteLock();
    private final AiEmbeddingProperties properties;

    public HnswEmbeddingIndex(AiEmbeddingProperties properties) {
        this.properties = properties;
    }

    /**
     * Build/rebuild index từ danh sách embedding mới.
     * Gọi khi cache được refresh.
     */
    public void rebuild(List<QuestionEmbeddingSnapshot> embeddings) {
        rebuildLock.writeLock().lock();
        try {
            List<IndexEntry> newEntries = new ArrayList<>(embeddings.size());
            for (int i = 0; i < embeddings.size(); i++) {
                newEntries.add(new IndexEntry(i, embeddings.get(i)));
            }

            int M = properties.getHnswM();  // Default: 16
            int efConstruction = properties.getHnswEfConstruction();  // Default: 200

            HnswGraphBuilder<IndexEntry> builder = new HnswGraphBuilder<>(
                new CosineVectorScorer(newEntries),
                M,
                efConstruction,
                System.currentTimeMillis()
            );

            for (IndexEntry entry : newEntries) {
                builder.addGraphNode(entry.id);
            }

            this.entries.set(List.copyOf(newEntries));
            this.graph.set(builder);
            log.info("HNSW index rebuilt with {} vectors (M={}, efConstruction={})",
                newEntries.size(), M, efConstruction);
        } finally {
            rebuildLock.writeLock().unlock();
        }
    }

    /**
     * Search k nearest neighbors.
     */
    public List<SearchResult> search(double[] query, int k) {
        rebuildLock.readLock().lock();
        try {
            HnswGraphBuilder<IndexEntry> currentGraph = graph.get();
            List<IndexEntry> currentEntries = entries.get();

            if (currentGraph == null || currentEntries.isEmpty()) {
                return List.of();
            }

            int efSearch = properties.getHnswEfSearch();  // Default: 100

            NeighborArray results = HnswGraphSearcher.search(
                new CosineVectorScorer(currentEntries).withQueryVector(query),
                currentGraph,
                currentGraph.entryNode(),
                efSearch,
                System.currentTimeMillis()
            );

            List<SearchResult> output = new ArrayList<>(Math.min(k, results.size()));
            for (int i = 0; i < Math.min(k, results.size()); i++) {
                int nodeId = results.node()[i];
                float score = results.score()[i];
                IndexEntry entry = currentEntries.get(nodeId);
                output.add(new SearchResult(
                    entry.snapshot.questionId(),
                    entry.snapshot.stem(),
                    (double) score,
                    entry.snapshot.vector()
                ));
            }
            return output;
        } finally {
            rebuildLock.readLock().unlock();
        }
    }

    /**
     * Search + verify: HNSW tìm top-k candidates, sau đó exact cosine để có kết quả chính xác.
     */
    public SearchResult searchBestMatch(double[] query, double threshold) {
        int k = properties.getHnwSearchK();  // Default: 10 (candidates từ HNSW)
        List<SearchResult> candidates = search(query, k);

        SearchResult best = null;
        double bestExactScore = 0;

        for (SearchResult candidate : candidates) {
            double exactScore = CosineUtil.cosine(query, candidate.vector());
            if (exactScore > bestExactScore) {
                bestExactScore = exactScore;
                best = new SearchResult(
                    candidate.questionId(),
                    candidate.stem(),
                    exactScore,
                    candidate.vector()
                );
            }
            if (bestExactScore >= threshold) break;  // Early termination
        }

        return best;
    }

    public int size() {
        return entries.get().size();
    }

    // -- Inner types --

    private record IndexEntry(int id, QuestionEmbeddingSnapshot snapshot) {}

    public record SearchResult(Long questionId, String stem, double similarity, double[] vector) {}

    /**
     * Cosine similarity scorer for HNSW.
     * HNSW expects distance, so we use 1 - cosine as distance.
     */
    private static class CosineVectorScorer extends RandomVectorScorer.AbstractRandomVectorScorer<IndexEntry> {
        private final List<IndexEntry> entries;
        private double[] query;

        CosineVectorScorer(List<IndexEntry> entries) {
            super(null);  // ScorerProvider sẽ set sau
            this.entries = entries;
        }

        CosineVectorScorer withQueryVector(double[] query) {
            this.query = query;
            return this;
        }

        @Override
        public double score(int node) {
            IndexEntry entry = entries.get(node);
            return 1.0 - CosineUtil.cosine(query, entry.snapshot.vector());
        }
    }
}
```

### 3.3.3 Tích hợp vào `DuplicateCheckService`

**File: `DuplicateCheckService.java`**

```java
private final HnswEmbeddingIndex hnswIndex;  // Inject
private final EmbeddingCache embeddingCache;

private DuplicateCheckResult semanticCheck(String stem, Set<Long> excludedQuestionIds,
                                            Set<Long> excludedCandidateIds) {
    // 1. Embed câu hỏi mới
    double[] candidateVector = questionEmbeddingService.embedCandidateStem(stem);

    // 2. Dùng HNSW để tìm best match (O(log n) thay vì O(n))
    HnswEmbeddingIndex.SearchResult best = hnswIndex.searchBestMatch(
        candidateVector,
        properties.getDuplicate().getReviewMin()  // Chỉ quan tâm nếu > review threshold
    );

    // 3. Kiểm tra excluded IDs
    if (best != null && excludedQuestionIds.contains(best.questionId())) {
        // Best match bị exclude → fallback về exact search top-k candidates
        best = findBestExcluding(candidateVector, excludedQuestionIds, excludedCandidateIds);
    }

    // 4. Lexical check cho candidates (giữ logic hiện tại)
    DuplicateCheckResult candidateBatchDuplicate = lexicalCandidateCheck(stem, excludedCandidateIds);

    // 5. So sánh semantic best vs lexical candidate best
    double bestScore = best != null ? best.similarity() : 0;
    if (candidateBatchDuplicate.maxSimilarity() > bestScore) {
        return candidateBatchDuplicate;
    }

    if (best == null) {
        return new DuplicateCheckResult(0, null, null, false, false, null, "e5-hnsw");
    }

    return new DuplicateCheckResult(
        best.similarity(),
        best.questionId(),
        best.stem(),
        best.similarity() >= properties.getDuplicate().getStrongMin(),
        best.similarity() >= properties.getDuplicate().getReviewMin(),
        null,
        "e5-hnsw"
    );
}
```

### 3.3.4 Tích hợp với Cache — auto rebuild

**File: `EmbeddingCache.java`**

```java
private final HnswEmbeddingIndex hnswIndex;  // Inject

public List<QuestionEmbeddingSnapshot> approvedStemEmbeddings() {
    if (cache == null) {
        return embeddingService.loadAllApprovedStemEmbeddings();
    }
    List<QuestionEmbeddingSnapshot> result = cache.get(APPROVED_STEMS_KEY);

    // Rebuild HNSW index sau khi cache load (async, lần đầu)
    if (result != null && hnswIndex.size() != result.size()) {
        hnswIndex.rebuild(result);
    }
    return result;
}

public void invalidate() {
    if (cache != null) {
        cache.invalidateAll();
        // Không rebuild HNSW ngay — sẽ rebuild khi cache load lại
    }
}
```

### 3.3.5 Config

**File: `AiEmbeddingProperties.java`**

```java
// HNSW parameters
private int hnswM = 16;                // Số connection per node (higher = chính xác hơn, tốn memory hơn)
private int hnswEfConstruction = 200;  // Search depth khi build index
private int hnswEfSearch = 100;        // Search depth khi query
private int hnswSearchK = 10;          // Số candidates HNSW trả về để exact verify
private boolean hnswEnabled = true;    // Feature flag
```

**File: `application.yaml`**

```yaml
ai:
  embedding:
    hnsw-enabled: ${E5_HNSW_ENABLED:true}
    hnsw-m: ${E5_HNSW_M:16}
    hnsw-ef-construction: ${E5_HNSW_EF_CONSTRUCTION:200}
    hnsw-ef-search: ${E5_HNSW_EF_SEARCH:100}
    hnsw-search-k: ${E5_HNSW_SEARCH_K:10}
```

---

## 3.4 Giải pháp thay thế: LSH (Locality-Sensitive Hashing) đơn giản hơn

Nếu không muốn dependency Lucene, có thể tự implement LSH với random projection:

```java
public class SimpleLshIndex {
    private final double[][] randomVectors;  // k random vectors, mỗi vector 384 dims
    private final Map<String, List<Integer>> buckets;  // hash → list of node indices
    private final List<double[]> vectors;

    /**
     * Hash 1 vector thành chuỗi bit.
     * Mỗi bit là sign của dot product với 1 random vector.
     */
    private String hash(double[] vector) {
        StringBuilder sb = new StringBuilder();
        for (double[] rv : randomVectors) {
            double dot = 0;
            for (int i = 0; i < vector.length; i++) dot += vector[i] * rv[i];
            sb.append(dot >= 0 ? '1' : '0');
        }
        return sb.toString();
    }

    /**
     * Search: hash query → lấy bucket → exact search trong bucket.
     */
    public List<Integer> search(double[] query, int maxCandidates) {
        String queryHash = hash(query);
        List<Integer> candidates = buckets.getOrDefault(queryHash, List.of());
        // Có thể mở rộng ra các bucket lân cận (Hamming distance 1, 2...)
        return candidates.stream().limit(maxCandidates).toList();
    }
}
```

**Trade-off:** Đơn giản hơn, ít dependency, nhưng accuracy thấp hơn HNSW (~90% vs ~99%).

---

## 3.5 Early termination trong exact search

Ngay cả khi chưa implement ANN, có thể thêm early termination:

```java
// Trong DuplicateCheckService.semanticCheck():
for (QuestionEmbeddingSnapshot embedding : embeddings) {
    double score = CosineUtil.cosine(candidateVector, embedding.vector());
    if (score > best) best = score;

    // Early termination: nếu đã vượt strong threshold → không cần tìm nữa
    if (best >= properties.getDuplicate().getStrongMin()) {
        break;
    }
}
```

---

## 3.6 Kế hoạch triển khai

### Bước 1: Thêm early termination (đơn giản, làm ngay)
- Thêm `break` khi `best >= strongMin`

### Bước 2: Tích hợp Lucene HNSW
- Thêm dependency
- Implement `HnswEmbeddingIndex`
- Tích hợp với `DuplicateCheckService` qua feature flag

### Bước 3: Test accuracy
- So sánh kết quả HNSW vs exact search trên dataset thực tế
- Điều chỉnh M, efSearch để đạt recall > 99%

### Bước 4: Productionize
- Monitoring: index size, search latency, recall rate
- Auto-tune parameters dựa trên dataset size

---

## 3.7 Kỳ vọng kết quả

| Metric | Trước (linear) | Sau (HNSW) |
|---|---|---|
| Search complexity | O(n×d) | O(log n × d) |
| 500 câu | ~1-2ms | ~0.3ms |
| 5,000 câu | ~10-20ms | **~0.5ms** |
| 50,000 câu | ~100-200ms | **~1ms** |
| Accuracy | 100% (exact) | ~99.5% (approximate + exact verify) |
| Memory overhead | 0 | ~M × n × 4 bytes (M=16: ~32KB/5000 nodes) |

---

## 3.8 Risk assessment

- **Accuracy regression**: HNSW có thể miss best match. Giải quyết bằng:
  - Search với efSearch cao (100-200)
  - Exact verify top-k candidates
  - Fallback về exact search nếu recall < threshold
- **Lucene dependency**: Thêm 3-5MB vào jar size. Đánh đổi để có HNSW implementation đã được test kỹ
- **Index rebuild time**: Với 5000 vectors, build mất ~100-200ms — chấp nhận được
- **Memory cho HNSW graph**: Mỗi connection = 1 int (4 bytes). M=16, 5000 nodes → ~320KB — không đáng kể
