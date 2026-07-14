# VietQuill Paraphrase Model — Kế hoạch tối ưu

> **Ngày:** 2026-07-14 | **Branch:** ManhTuan
>
> Tài liệu phân tích và kế hoạch tối ưu hiệu năng cho VietQuill T5 paraphrase model (ONNX Runtime).

---

## Tổng quan hiện trạng

Pipeline paraphrase sử dụng model `ngwgsang/vietquill-vit5-base-tsubaki` chạy qua ONNX Runtime với 2 seq2seq heads (question + sentence). Hiện tại hoạt động đúng chức năng nhưng **hiệu năng chưa tối ưu**:

| Vấn đề chính | Impact |
|---|---|
| Không preload model | Request đầu tiên chậm 2-5s (load model + JIT) |
| `synchronized` global lock | Chỉ 1 request được xử lý tại 1 thời điểm |
| 5 field × N variants inference riêng lẻ | 5N lần encode-decode thay vì N |
| Beam search O(n²) không KV-cache | Decoder xử lý lại toàn bộ sequence mỗi step |
| `numBeams=4` không cần thiết | Nhân 4 số lần decoder forward pass |
| Không có timeout | Request có thể treo vĩnh viễn |

---

## Cấu trúc thư mục

```
developer_docs/tuan/questions/vietquill/
├── README.md                          ← File này (tổng quan)
├── 01-cau-hinh-va-khoi-dong.md        ← Phase 1: Quick wins (cấu hình)
├── 02-single-pass-generation.md       ← Phase 2: Gom inference (single-pass)
├── 03-handle-pool-concurrency.md      ← Phase 3: Handle pool (concurrency)
└── 04-kv-cache-beam-search.md         ← Phase 4: KV-cache (beam search)
```

---

## Lộ trình triển khai

```
Phase 1 ──────► Phase 2 ──────► Phase 3 ──────► Phase 4
(1-2h)          (1-2 ngày)     (1-2 ngày)      (3-5 ngày)
Cấu hình        Single-pass     Handle pool     KV-cache
Low risk        Medium risk     Medium risk     High risk
Nhanh hơn 20%   Nhanh hơn 5x    Throughput Nx   Nhanh hơn 5-10x
```

### Dependency graph:
- **Phase 1**: Độc lập — làm ngay được
- **Phase 2**: Phụ thuộc Phase 1 (cần config mới) — nên làm sau Phase 1
- **Phase 3**: Có thể làm độc lập, nhưng nên làm sau Phase 2 để tránh conflict
- **Phase 4**: Phụ thuộc Phase 2+3 — cần single-pass + pool trước khi tối ưu sâu

---

## Chi tiết từng Phase

### Phase 1: Cấu hình & Khởi động
**File:** [01-cau-hinh-va-khoi-dong.md](01-cau-hinh-va-khoi-dong.md)

| Thay đổi | Impact |
|---|---|
| `preload: false → true` | Model sẵn sàng khi startup |
| Thêm warmup inference | ONNX JIT compile sẵn |
| `numBeams: 4 → 2` | Giảm 50% decoder work |
| `maxOutputLength: 512 → 128` | Consistent với hard-cap |
| Wrap paraphrase với `CompletableFuture` timeout | Không treo vĩnh viễn |

**Files:** `application.yaml`, `AiParaphraseProperties.java`, `VietQuillParaphraseModelService.java`

---

### Phase 2: Single-pass Generation
**File:** [02-single-pass-generation.md](02-single-pass-generation.md)

| Thay đổi | Impact |
|---|---|
| Generate toàn bộ MCQ trong 1 lần (thay vì 5 field riêng) | Giảm 5N → N lần encode-decode |
| Cập nhật `VietQuillPromptBuilder` + `VietQuillMcqParser` | Parse full MCQ output |
| Feature flag `singlePassEnabled` | A/B test, fallback an toàn |

**Files:** `VietQuillPromptBuilder.java`, `VietQuillMcqParser.java`, `VietQuillParaphraseModelService.java`, `AiParaphraseProperties.java`

---

### Phase 3: Handle Pool
**File:** [03-handle-pool-concurrency.md](03-handle-pool-concurrency.md)

| Thay đổi | Impact |
|---|---|
| `VietQuillHandlePool` (BlockingQueue) | N session = N concurrent requests |
| Bỏ `synchronized` trên generate | Mỗi thread có handle riêng |
| `poolSize=2` mặc định | 2 requests đồng thời |

**Files:** `VietQuillHandlePool.java` (mới), `VietQuillParaphraseModelService.java`, `AiParaphraseProperties.java`

---

### Phase 4: KV-Cache Beam Search
**File:** [04-kv-cache-beam-search.md](04-kv-cache-beam-search.md)

| Thay đổi | Impact |
|---|---|
| Decoder chỉ xử lý 1 token mới/step | O(n²) → O(n) |
| Cần model export với `use_cache=True` | Có thể phải re-export model |
| KV-cache management cho beam search | Phức tạp nhất trong các phase |

**Files:** `VietQuillParaphraseModelService.java`, model ONNX files (re-export nếu cần)

---

## Code map — Các file liên quan

```
questiongeneration/
├── config/
│   └── AiParaphraseProperties.java          ← Config cho tất cả phase
├── modelruntime/
│   ├── ParaphraseModelService.java          ← Interface
│   ├── ParaphraseModelInput.java            ← Input model
│   ├── ParaphrasedMcq.java                  ← Output model
│   └── vietquill/
│       ├── VietQuillParaphraseModelService.java  ← ⚡ CORE: inference engine
│       ├── VietQuillPromptBuilder.java           ← Prompt builder
│       ├── VietQuillMcqParser.java               ← Output parser
│       ├── ProtectedTermService.java             ← Protected term extraction
│       └── VietQuillHandlePool.java              ← (MỚI - Phase 3) Object pool
├── paraphrase/
│   ├── ParaphraseService.java               ← Business logic layer
│   ├── ParaphraseMapper.java                ← Entity ↔ DTO
│   ├── ParaphraseValidationService.java     ← Validation + E5 check
│   └── ParaphraseValidationResult.java      ← Validation result record
├── controller/
│   └── ParaphraseController.java            ← REST API endpoints
├── entity/
│   ├── ParaphraseJob.java
│   ├── ParaphraseCandidate.java
│   └── enums/ParaphraseMode.java, ParaphraseJobStatus.java
└── repository/
    ├── ParaphraseJobRepository.java
    └── ParaphraseCandidateRepository.java
```

---

## Metrics mục tiêu

| Metric | Hiện tại | Phase 1 | Phase 1+2 | Phase 1+2+3 | Phase 1+2+3+4 |
|---|---|---|---|---|---|
| **Latency 1 variant** | 3-5s | 2-4s | 0.8-1.5s | 0.8-1.5s | **0.2-0.5s** |
| **Latency 3 variants** | 8-15s | 5-10s | 2-4s | 2-4s | **0.5-1.5s** |
| **Concurrent requests** | 1 | 1 | 1 | N (pool) | N (pool) |
| **Startup penalty** | 2-5s (request 1) | 0s | 0s | 0s | 0s |
| **RAM usage** | ~400MB | ~400MB | ~400MB | ~400MB×N | ~500MB×N |
| **Timeout protection** | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## Risk profile

```
Phase 1: ████░░░░░░ Low       (chỉ thay config + thêm timeout)
Phase 2: ██████░░░░ Medium    (thay đổi prompt → output format có thể khác)
Phase 3: ██████░░░░ Medium    (tăng RAM, ONNX session management)
Phase 4: ██████████ High      (cần re-export model, quản lý KV-cache phức tạp)
```

---

## Ghi chú triển khai

1. **Mỗi phase có feature flag riêng** để dễ dàng enable/disable và A/B test
2. **Luôn giữ code cũ làm fallback** — nếu phase mới có vấn đề, revert về logic cũ
3. **Test smoke test** (`VietQuillParaphraseModelSmokeTest`) sau mỗi phase
4. **Đo latency** trước và sau mỗi phase để verify improvement
5. **Phase 4 là optional** — nếu Phase 1-3 đã đạt latency mục tiêu, có thể skip Phase 4

---

## Liên quan

- **E5 Embedding tối ưu**: Chưa có plan (sẽ làm sau)
- **DeepSeek Generation tối ưu**: Chưa có plan (sẽ làm sau)
- **DuplicateCheckService**: Cần tối ưu top500 limit + ANN index (sẽ làm sau)
