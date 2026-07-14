# E5 Embedding Model — Kế hoạch tối ưu Dedup & Check Trùng

> **Ngày:** 2026-07-14 | **Branch:** ManhTuan
>
> Tài liệu phân tích và kế hoạch tối ưu cho E5 embedding model (ONNX Runtime) dùng để kiểm tra trùng lặp câu hỏi.

---

## Tổng quan hiện trạng

E5 embedding pipeline sử dụng model `intfloat/multilingual-e5-small` (384 dims) qua ONNX Runtime để:
1. Tạo vector embedding cho stem của câu hỏi đã duyệt
2. So sánh cosine similarity để phát hiện câu hỏi trùng lặp
3. Fallback về lexical (Jaccard token set) khi E5 không khả dụng

Pipeline hoạt động đúng về mặt chức năng, nhưng có **bug correctness nghiêm trọng** và tiềm năng tối ưu hiệu năng lớn:

| Vấn đề chính | Impact | Severity |
|---|---|---|
| **Chỉ check top 500 embedding** | Bỏ sót trùng lặp với câu cũ khi ngân hàng > 500 câu | **P0 - Bug** |
| O(n) linear scan toàn bộ vector | Chậm khi ngân hàng > 1000 câu | P1 |
| Vector lưu dạng JSON text trong DB | Serialize/deserialize tốn CPU, storage lớn | P2 |
| Backfill tuần tự từng câu, block startup | Startup chậm khi nhiều câu hỏi | P2 |
| Lexical fallback chỉ check top 100 | Bỏ sót trùng lặp lexical với câu cũ | P2 |
| Cosine implementation trùng lặp | Code smell, dễ gây bug khi sửa | P3 |
| Không có in-memory cache embedding | Mỗi lần check đều query DB + parse JSON | P1 |

---

## Cấu trúc thư mục

```
developer_docs/tuan/questions/e5/
├── README.md                              ← File này (tổng quan)
├── 01-sua-loi-top500-va-cau-hinh.md       ← Phase 1: Fix bug top500 + quick config wins
├── 02-in-memory-cache-va-vector-storage.md ← Phase 2: Cache + tối ưu storage vector
├── 03-ann-index-hnsw.md                   ← Phase 3: ANN index (HNSW) sub-linear search
└── 04-batch-inference-va-async-backfill.md ← Phase 4: Batch inference + async backfill
```

---

## Lộ trình triển khai

```
Phase 1 ──────► Phase 2 ──────► Phase 3 ──────► Phase 4
(2-4h)          (1-2 ngày)     (2-3 ngày)      (2-3 ngày)
Fix bug +       In-memory      ANN index       Batch +
Config          cache          HNSW            Async
Low risk        Low risk       Medium risk     Medium risk
Sửa lỗi         Nhanh hơn 3x   Nhanh hơn 10x   Nhanh hơn 5x
correctness                                   (backfill)
```

### Dependency graph:
- **Phase 1**: Độc lập, làm NGAY — sửa bug correctness
- **Phase 2**: Phụ thuộc Phase 1 (cần pagination đã fix) — nên làm ngay sau
- **Phase 3**: Có thể làm độc lập, nhưng nên có Phase 2 trước (cache giúp index build nhanh hơn)
- **Phase 4**: Độc lập, có thể làm bất kỳ lúc nào

---

## Chi tiết từng Phase

### Phase 1: Fix lỗi top500 + Cấu hình
**File:** [01-sua-loi-top500-va-cau-hinh.md](01-sua-loi-top500-va-cau-hinh.md)

| Thay đổi | Impact |
|---|---|
| Sửa `findTop500` → paginate toàn bộ embedding | Sửa bug bỏ sót trùng lặp |
| Tăng `findTop100` lexical fallback → paginate | Lexical cũng check toàn bộ |
| Thêm DB index cho embedding lookup | Query nhanh hơn |
| Configurable page size + concurrency | Linh hoạt theo quy mô |
| Extract shared `CosineUtil` | Code sạch hơn |

---

### Phase 2: In-memory Cache + Vector Storage
**File:** [02-in-memory-cache-va-vector-storage.md](02-in-memory-cache-va-vector-storage.md)

| Thay đổi | Impact |
|---|---|
| Caffeine cache toàn bộ approved embedding | Không query DB + parse JSON mỗi lần check |
| Đổi `vectorJson` (TEXT) → `vector` (FLOAT8[]) | Storage giảm ~70%, query nhanh hơn |
| Cache refresh strategy (on save/approve) | Cache luôn đồng bộ |
| Startup warmup cache | Sẵn sàng ngay khi app start |

---

### Phase 3: ANN Index (HNSW)
**File:** [03-ann-index-hnsw.md](03-ann-index-hnsw.md)

| Thay đổi | Impact |
|---|---|
| Build HNSW graph trên in-memory vectors | Search O(log n) thay vì O(n) |
| Configurable M, efConstruction, efSearch | Trade-off accuracy vs speed |
| Periodic index rebuild (khi có thay đổi) | Index luôn up-to-date |
| Fallback về exact search nếu ANN miss | Không mất correctness |

---

### Phase 4: Batch Inference + Async Backfill
**File:** [04-batch-inference-va-async-backfill.md](04-batch-inference-va-async-backfill.md)

| Thay đổi | Impact |
|---|---|
| Batch N stems → 1 ONNX forward pass | Backfill nhanh hơn 5-10x |
| Async backfill (không block startup) | App start nhanh hơn |
| Incremental backfill (chỉ câu mới/chưa có) | Không lãng phí compute |
| ONNX execution provider tuning | Tận dụng tối đa CPU |

---

## Code map — Các file liên quan

```
questiongeneration/
├── config/
│   └── AiEmbeddingProperties.java             ← Config E5
├── modelruntime/
│   ├── EmbeddingModelService.java             ← Interface
│   ├── EmbeddingModelException.java           ← Exception
│   └── e5/
│       ├── E5EmbeddingModelService.java       ← ⚡ CORE: ONNX inference
│       └── E5TextPreprocessor.java            ← Preprocessor (query:/passage: prefix)
├── embedding/
│   ├── QuestionEmbeddingService.java          ← Business logic (save, backfill, load)
│   ├── QuestionEmbeddingSnapshot.java         ← Record cho in-memory cache
│   └── QuestionEmbeddingStartupBackfill.java  ← Startup backfill listener
├── service/
│   ├── DuplicateCheckService.java             ← ⚡ Dedup logic (semantic + lexical)
│   └── model/
│       └── DuplicateCheckResult.java          ← Kết quả duplicate check
├── entity/
│   └── QuestionEmbedding.java                 ← JPA entity (vectorJson column)
└── repository/
    └── QuestionEmbeddingRepository.java       ← JPA repository (top500 query)
```

---

## Metrics mục tiêu

| Metric | Hiện tại | Phase 1 | Phase 1+2 | Phase 1+2+3 | Phase 1+2+3+4 |
|---|---|---|---|---|---|
| **Coverage (số câu được check)** | 500 | **Toàn bộ** | Toàn bộ | Toàn bộ | Toàn bộ |
| **Dedup latency (500 câu)** | ~5-15ms | ~5-15ms | ~1-2ms | **~0.1-0.5ms** | ~0.1-0.5ms |
| **Dedup latency (5000 câu)** | N/A (chỉ check 500!) | ~50-100ms | ~10-20ms | **~0.5-2ms** | ~0.5-2ms |
| **Storage/embedding** | ~3KB JSON | ~3KB JSON | ~1.5KB float8[] | ~1.5KB | ~1.5KB |
| **Backfill 1000 câu** | ~30-60s (block) | ~30-60s (block) | ~30-60s (block) | ~30-60s (block) | **~5-10s (async)** |
| **DB queries / dedup** | 1 heavy query | N pages | 0 (cache hit) | 0 (cache hit) | 0 (cache hit) |
| **Correctness bug** | ❌ top500 | ✅ Đã sửa | ✅ | ✅ | ✅ |

---

## Risk profile

```
Phase 1: ███░░░░░░░ Very Low  (sửa bug + thêm config, không đổi logic)
Phase 2: ████░░░░░░ Low       (cache + đổi column type, có migration)
Phase 3: ██████░░░░ Medium    (ANN index, cần tune tham số)
Phase 4: ██████░░░░ Medium    (batch ONNX, async execution)
```

---

## Ghi chú triển khai

1. **Phase 1 là CRITICAL** — sửa bug correctness, nên deploy ngay
2. **Phase 2 cần DB migration** — đổi cột `vector_json` (TEXT) → `vector` (FLOAT8[]). Cần migration script + backward compatibility
3. **Phase 3 (ANN) là optional** nếu ngân hàng < 2000 câu — cache hit đã đủ nhanh
4. **Mỗi phase có feature flag** để dễ enable/disable và rollback
5. **Giữ lexical fallback** — luôn có fallback khi E5 không hoạt động

---

## Liên quan

- **VietQuill tối ưu**: [../vietquill/README.md](../vietquill/README.md)
- **DeepSeek Generation tối ưu**: Chưa có plan
- **DuplicateCheckService**: Được cover trong Phase 1-3 của plan này
