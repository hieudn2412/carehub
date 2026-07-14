# Phase 1: Fix lỗi top500 + Cấu hình tối ưu

> **Mục tiêu:** Sửa bug correctness (chỉ check 500 embedding) + quick config wins
> **Độ phức tạp:** Thấp | **Risk:** Rất thấp | **Kỳ vọng:** Sửa lỗi bỏ sót trùng lặp, code sạch hơn

---

## 1.1 Hiện trạng — Bug top500

### File: `QuestionEmbeddingRepository.java` (line 19-23)

```java
List<QuestionEmbedding> findTop500ByTextTypeAndEmbeddingModelAndQuestion_StatusOrderByIdDesc(
        String textType,
        String embeddingModel,
        QuestionBankStatus status
);
```

### File: `QuestionEmbeddingService.java` (lines 125-139)

```java
public List<QuestionEmbeddingSnapshot> approvedStemEmbeddings() {
    return embeddingRepository
            .findTop500ByTextTypeAndEmbeddingModelAndQuestion_StatusOrderByIdDesc(  // ← CHỈ 500!
                    STEM_TEXT_TYPE,
                    properties.getModel(),
                    QuestionBankStatus.APPROVED
            )
            .stream()
            .map(embedding -> new QuestionEmbeddingSnapshot(
                    embedding.getQuestion().getId(),
                    embedding.getQuestion().getStem(),
                    fromJson(embedding.getVectorJson())
            ))
            .toList();
}
```

### File: `DuplicateCheckService.java` (lines 69-114)

```java
private DuplicateCheckResult semanticCheck(...) {
    double[] candidateVector = questionEmbeddingService.embedCandidateStem(stem);

    List<QuestionEmbeddingSnapshot> embeddings = questionEmbeddingService.approvedStemEmbeddings();
    // ← embeddings chỉ có tối đa 500 phần tử!

    for (QuestionEmbeddingSnapshot embedding : embeddings) {
        if (excludedQuestionIds.contains(embedding.questionId())) {
            continue;
        }
        double score = cosine(candidateVector, embedding.vector());
        // ...
    }
}
```

### Tương tự cho lexical fallback:

### File: `DuplicateCheckService.java` (lines 121, 132)

```java
for (QuestionBankQuestion question : questionRepository.findTop100ByStatus(QuestionBankStatus.APPROVED)) {
    // ← CHỈ 100 câu! Nếu ngân hàng có 5000 câu, 4900 câu không được check
}

for (DocumentQuestionCandidate candidate : candidateRepository.findTop100ByStatusIn(COMPARABLE_CANDIDATE_STATUSES)) {
    // ← CHỈ 100 candidates!
}
```

### Vấn đề:

- **Ngân hàng > 500 câu APPROVED**: Các câu cũ (ID thấp) không bao giờ được check trùng
- **Ngân hàng > 100 câu**: Lexical fallback cũng bỏ sót
- `OrderByIdDesc` → ưu tiên câu mới nhất, câu cũ bị loại trước
- Đây là **correctness bug**, không phải performance issue

---

## 1.2 Fix: Paginate toàn bộ embedding

### 1.2.1 Cập nhật Repository — thêm phương thức pagination

**File: `QuestionEmbeddingRepository.java`**

```java
// Thay thế findTop500 bằng:
@Query("""
    SELECT e FROM QuestionEmbedding e
    JOIN FETCH e.question
    WHERE e.textType = :textType
      AND e.embeddingModel = :embeddingModel
      AND e.question.status = :status
    ORDER BY e.id DESC
    """)
List<QuestionEmbedding> findPageByTextTypeAndEmbeddingModelAndQuestionStatus(
        @Param("textType") String textType,
        @Param("embeddingModel") String embeddingModel,
        @Param("status") QuestionBankStatus status,
        Pageable pageable
);

// Giữ lại method cũ cho backward compatibility (nếu cần)
// @Deprecated
// List<QuestionEmbedding> findTop500ByTextTypeAndEmbeddingModelAndQuestion_StatusOrderByIdDesc(...);
```

### 1.2.2 Cập nhật `QuestionEmbeddingService` — pagination loop

**File: `QuestionEmbeddingService.java`**

```java
private static final int EMBEDDING_PAGE_SIZE = 500;  // Configurable

public List<QuestionEmbeddingSnapshot> approvedStemEmbeddings() {
    List<QuestionEmbeddingSnapshot> allEmbeddings = new ArrayList<>();
    int page = 0;
    Pageable pageable = PageRequest.of(page, EMBEDDING_PAGE_SIZE);

    List<QuestionEmbedding> pageResult;
    do {
        pageResult = embeddingRepository
                .findPageByTextTypeAndEmbeddingModelAndQuestionStatus(
                        STEM_TEXT_TYPE,
                        properties.getModel(),
                        QuestionBankStatus.APPROVED,
                        pageable
                );
        for (QuestionEmbedding embedding : pageResult) {
            allEmbeddings.add(new QuestionEmbeddingSnapshot(
                    embedding.getQuestion().getId(),
                    embedding.getQuestion().getStem(),
                    fromJson(embedding.getVectorJson())
            ));
        }
        page++;
        pageable = PageRequest.of(page, EMBEDDING_PAGE_SIZE);
    } while (!pageResult.isEmpty() && pageResult.size() == EMBEDDING_PAGE_SIZE);

    return allEmbeddings;
}
```

### 1.2.3 Cập nhật `DuplicateCheckService` — lexical pagination

**File: `DuplicateCheckService.java`** — Thay `findTop100ByStatus` bằng paginated:

```java
// Trong QuestionBankQuestionRepository:
List<QuestionBankQuestion> findByStatus(QuestionBankStatus status, Pageable pageable);

// Trong DocumentQuestionCandidateRepository:
List<DocumentQuestionCandidate> findByStatusIn(Collection<CandidateStatus> statuses, Pageable pageable);

// Trong DuplicateCheckService.lexicalCheck():
private DuplicateCheckResult lexicalCheck(String stem, Set<Long> excludedQuestionIds,
                                           Set<Long> excludedCandidateIds) {
    double best = 0;
    Long matchedId = null;
    String matchedStem = null;
    int page = 0;
    final int pageSize = 500;

    // Check ALL approved questions (paginated)
    List<QuestionBankQuestion> questionPage;
    do {
        questionPage = questionRepository.findByStatus(
            QuestionBankStatus.APPROVED, PageRequest.of(page++, pageSize));
        for (QuestionBankQuestion question : questionPage) {
            if (excludedQuestionIds.contains(question.getId())) continue;
            double score = similarity(stem, question.getStem());
            if (score > best) {
                best = score;
                matchedId = question.getId();
                matchedStem = question.getStem();
            }
        }
    } while (!questionPage.isEmpty() && questionPage.size() == pageSize);

    // Tương tự cho candidates...
    // ...

    return new DuplicateCheckResult(best, matchedId, matchedStem,
        best >= properties.getDuplicate().getStrongMin(),
        best >= properties.getDuplicate().getReviewMin());
}
```

---

## 1.3 Database Index

Thêm index để pagination query nhanh:

```sql
-- File migration: V2__add_embedding_lookup_index.sql
CREATE INDEX IF NOT EXISTS idx_embedding_lookup
ON question_embeddings (text_type, embedding_model, question_id)
WHERE text_type = 'stem';

-- Hoặc composite index đơn giản hơn:
CREATE INDEX IF NOT EXISTS idx_embedding_text_model_status
ON question_embeddings (text_type, embedding_model, id DESC);
```

---

## 1.4 Configurable page size

**File: `AiEmbeddingProperties.java`**

```java
private int dedupPageSize = 500;       // Kích thước mỗi trang khi load embedding
private int lexicalPageSize = 500;     // Kích thước trang cho lexical check
```

**File: `application.yaml`**

```yaml
ai:
  embedding:
    dedup-page-size: ${E5_DEDUP_PAGE_SIZE:500}
    lexical-page-size: ${E5_LEXICAL_PAGE_SIZE:500}
```

---

## 1.5 Extract shared `CosineUtil`

Hiện tại `cosine()` được implement ở 2 nơi:

- `DuplicateCheckService.java` (line 196-213)
- `ParaphraseValidationService.java` (line 164-181)

**File mới: `common/util/CosineUtil.java`**

```java
package vn.vietduc.carehubbackend.common.util;

public final class CosineUtil {
    private CosineUtil() {}

    public static double cosine(double[] left, double[] right) {
        int size = Math.min(left.length, right.length);
        if (size == 0) return 0;

        double dot = 0, leftNorm = 0, rightNorm = 0;
        for (int i = 0; i < size; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];
        }
        if (leftNorm == 0 || rightNorm == 0) return 0;
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
    }

    /**
     * Cosine similarity với early termination: dừng sớm nếu không thể vượt qua threshold.
     * Hữu ích khi chỉ cần biết similarity > threshold, không cần giá trị chính xác.
     */
    public static boolean exceeds(double[] left, double[] right, double threshold) {
        // Nếu threshold = 0, luôn true (bỏ qua early termination)
        if (threshold <= 0) return true;

        int size = Math.min(left.length, right.length);
        double dot = 0, leftNorm = 0, rightNorm = 0;

        for (int i = 0; i < size; i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];

            // Early termination: ước tính upper bound của cosine sau mỗi N dims
            if ((i + 1) % 64 == 0) {
                double currentCosine = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
                double remainingDims = size - i - 1;
                // Maximum possible cosine nếu các dim còn lại khớp hoàn hảo
                double upperBound = (dot + remainingDims) /
                    Math.sqrt((leftNorm + remainingDims) * (rightNorm + remainingDims));
                if (upperBound < threshold) return false;
            }
        }
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm)) >= threshold;
    }
}
```

Cập nhật 2 file gọi:
- `DuplicateCheckService.java`: `CosineUtil.cosine(left, right)`
- `ParaphraseValidationService.java`: `CosineUtil.cosine(left, right)`

---

## 1.6 Files cần sửa

| File | Thay đổi |
|---|---|
| `QuestionEmbeddingRepository.java` | Thêm paginated query, deprecate `findTop500` |
| `QuestionBankQuestionRepository.java` | Thêm `findByStatus(Status, Pageable)` |
| `DocumentQuestionCandidateRepository.java` | Thêm `findByStatusIn(Collection, Pageable)` |
| `QuestionEmbeddingService.java` | Sửa `approvedStemEmbeddings()` → pagination loop |
| `DuplicateCheckService.java` | Sửa `lexicalCheck()` → pagination; dùng `CosineUtil` |
| `ParaphraseValidationService.java` | Dùng `CosineUtil` thay vì private method |
| `AiEmbeddingProperties.java` | Thêm `dedupPageSize`, `lexicalPageSize` |
| `application.yaml` | Thêm config page size |
| `common/util/CosineUtil.java` | **File mới** — shared cosine utility |
| Migration SQL | Thêm index `idx_embedding_lookup` |

---

## 1.7 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| Số embedding được check | Tối đa 500 | **Toàn bộ** (không giới hạn) |
| Số câu lexical được check | Tối đa 100 | **Toàn bộ** |
| Dedup latency (1000 câu) | ~10ms (500 câu) | ~20ms (1000 câu, chấp nhận được) |
| Code duplication | 2 nơi implement cosine | 1 shared utility |
| DB index | Không có | Có → query nhanh hơn |

---

## 1.8 Risk assessment

- **Tăng latency với ngân hàng lớn**: Với 5000+ câu, linear scan sẽ chậm hơn. Đây là trade-off tạm thời — Phase 2 (cache) và Phase 3 (ANN) sẽ giải quyết triệt để
- **Memory**: Load toàn bộ embedding vào memory (5000 câu × 384 dims × 8 bytes = ~15MB) — chấp nhận được
- **Pagination consistency**: Nếu có embedding được thêm/xóa giữa các page, có thể bỏ sót hoặc trùng lặp. Không nghiêm trọng với duplicate check (chỉ ảnh hưởng transient)
