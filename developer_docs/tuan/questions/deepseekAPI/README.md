# DeepSeek API Question Generation — Kế hoạch tối ưu

> **Ngày:** 2026-07-14 | **Branch:** ManhTuan
>
> Tài liệu phân tích và kế hoạch tối ưu cho pipeline tạo câu hỏi bằng DeepSeek API.

---

## Tổng quan hiện trạng

Pipeline tạo câu hỏi gọi DeepSeek API (`deepseek-v4-flash`) qua HTTP/REST, có circuit breaker, retry, rate limiting (semaphore). Hỗ trợ 2 pipeline mode (`single_call` và `multi_stage`) và optional LLM validation.

Pipeline có kiến trúc tốt nhưng còn **nhiều lỗ hổng resilience** và **cơ hội tối ưu throughput**:

| Vấn đề chính | Impact | Severity |
|---|---|---|
| **RestClient không có timeout** | Request treo vĩnh viễn nếu API không respond | **P0** |
| **Semaphore.acquire() không timeout** | Thread block vĩnh viễn khi hết permit | **P0** |
| **fallbackModel không được dùng** | Không fallback khi model chính fail | P1 |
| **RestClient tạo mới mỗi lần gọi** | Mất connection pooling, GC pressure | P1 |
| **Xử lý chunk tuần tự** | Không tận dụng được concurrent calls | P1 |
| **Không có metrics/telemetry** | Không đo được latency, error rate, cost | P2 |
| **Circuit breaker cơ bản** | Chỉ đếm consecutive failures, không half-open | P2 |
| **cost tracking = 0** | Không biết chi phí thực tế | P3 |

---

## Cấu trúc thư mục

```
developer_docs/tuan/questions/deepseekAPI/
├── README.md                                ← File này (tổng quan)
├── 01-fix-timeout-va-restclient-singleton.md ← Phase 1: Fix critical issues
├── 02-parallel-chunk-va-batch-validation.md  ← Phase 2: Parallel processing
├── 03-fallback-model-va-circuit-breaker.md   ← Phase 3: Resilience nâng cao
└── 04-metrics-va-cost-tracking.md            ← Phase 4: Observability
```

---

## Lộ trình triển khai

```
Phase 1 ──────► Phase 2 ──────► Phase 3 ──────► Phase 4
(2-4h)          (1-2 ngày)     (2-3 ngày)      (1-2 ngày)
Fix timeout     Parallel        Fallback        Metrics
RestClient      chunks          Model           Cost
Singleton       Batch validate  Half-open CB    Monitoring
Low risk        Medium risk     Medium risk     Low risk
Sửa lỗi treo    Nhanh hơn 2-4x  Resilient hơn   Observable
```

---

## Chi tiết từng Phase

### Phase 1: Fix Timeout & RestClient Singleton
**File:** [01-fix-timeout-va-restclient-singleton.md](01-fix-timeout-va-restclient-singleton.md)

| Thay đổi | Impact |
|---|---|
| RestClient singleton với connection pool | Connection reuse, giảm GC |
| Read/connect timeout từ config | Không treo vĩnh viễn |
| Semaphore.tryAcquire với timeout | Thread không block mãi mãi |
| Dọn dẹp double-checked locking | Code sạch hơn |

---

### Phase 2: Parallel Chunk & Batch Validation
**File:** [02-parallel-chunk-va-batch-validation.md](02-parallel-chunk-va-batch-validation.md)

| Thay đổi | Impact |
|---|---|
| Xử lý N chunk song song (trong giới hạn semaphore) | Throughput tăng 2-4x |
| Batch duplicate check cho nhiều candidate | Giảm số lần E5 query |
| Cache cancellation status (TTL 5s) | Giảm DB query |
| Pre-compute generation keys cho cả chunk | Giảm CPU waste |

---

### Phase 3: Fallback Model & Circuit Breaker
**File:** [03-fallback-model-va-circuit-breaker.md](03-fallback-model-va-circuit-breaker.md)

| Thay đổi | Impact |
|---|---|
| Fallback model khi primary fail | Tăng availability |
| Circuit breaker half-open state | Tự động recovery |
| Per-endpoint error tracking | Phân biệt lỗi auth vs rate limit vs server |
| Prompt caching (system prompt reuse) | Giảm token usage |

---

### Phase 4: Metrics & Cost Tracking
**File:** [04-metrics-va-cost-tracking.md](04-metrics-va-cost-tracking.md)

| Thay đổi | Impact |
|---|---|
| Micrometer metrics (latency, tokens, errors) | Monitoring được |
| Cost estimation theo DeepSeek pricing | Biết chi phí thực tế |
| Structured logging với trace ID | Debug dễ dàng |
| Health check endpoint cho generation | Monitoring pipeline health |

---

## Code map — Các file liên quan

```
questiongeneration/
├── config/
│   ├── AiGenerationProperties.java              ← Config DeepSeek API
│   ├── DocumentProcessingProperties.java        ← Config document/chunk
│   ├── DocumentQuestionAsyncConfig.java         ← Async executor config
│   └── ValidationRulesProperties.java           ← Validation thresholds
├── generation/
│   ├── DocumentQuestionGenerator.java           ← Interface
│   ├── DocumentQuestionGeneratorRouter.java     ← Router (chọn provider)
│   ├── DeepSeekDocumentQuestionGenerator.java   ← ⚡ CORE: DeepSeek API calls
│   └── MockDocumentQuestionGenerator.java       ← Mock fallback
├── service/
│   ├── DocumentQuestionJobService.java          ← ⚡ Job orchestration
│   ├── DocumentQuestionJobWorker.java           ← Async event listener
│   ├── DocumentQuestionJobCreatedEvent.java     ← Event record
│   ├── GenerationKeyService.java                ← Idempotency key
│   ├── QuestionCandidateValidationService.java  ← Validation logic
│   ├── DuplicateCheckService.java               ← Dedup check
│   ├── DocumentChunkingService.java             ← Chunking
│   ├── DocumentChunkQualityRules.java           ← Quality flags
│   └── DocumentTextPreprocessor.java            ← Text preprocessing
├── service/model/
│   ├── GenerationInput.java
│   ├── GeneratedChunkResult.java
│   ├── GeneratedKnowledgePoint.java
│   ├── GeneratedQuestion.java
│   ├── LlmUsage.java
│   └── CandidateValidationResult.java
└── entity/
    ├── DocumentQuestionJob.java
    ├── DocumentQuestionCandidate.java
    └── enums/JobStatus.java, GenerationProvider.java
```

---

## Metrics mục tiêu

| Metric | Hiện tại | Phase 1 | Phase 1+2 | Phase 1+2+3 | Phase 1+2+3+4 |
|---|---|---|---|---|---|
| **Timeout protection** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Connection reuse** | ❌ (mỗi call) | ✅ (pool) | ✅ | ✅ | ✅ |
| **Chunk processing** | Tuần tự | Tuần tự | **Song song** | Song song | Song song |
| **Fallback model** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Circuit breaker** | Cơ bản | Cơ bản | Cơ bản | **Half-open** | Half-open |
| **Cost tracking** | 0 | 0 | 0 | 0 | ✅ |
| **Metrics dashboard** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Risk profile

```
Phase 1: ███░░░░░░░ Very Low  (fix bug + singleton, không đổi logic)
Phase 2: █████░░░░░ Low-Med   (parallel processing, cần test kỹ thread safety)
Phase 3: ██████░░░░ Medium    (circuit breaker + fallback, thay đổi retry logic)
Phase 4: ████░░░░░░ Low       (chỉ thêm metrics, không đổi logic)
```

---

## Ghi chú triển khai

1. **Phase 1 nên deploy ngay** — không có timeout là rủi ro production
2. **Phase 2 cần test kỹ** — parallel chunk processing liên quan đến transaction boundary
3. **Phase 3 cần quyết định**: có đáng fallback sang model pro (đắt hơn) không?
4. **Các phase tương đối độc lập** — có thể triển khai song song nếu có nhiều người

---

## Liên quan

- **VietQuill tối ưu**: [../vietquill/README.md](../vietquill/README.md)
- **E5 Embedding tối ưu**: [../e5/README.md](../e5/README.md)
