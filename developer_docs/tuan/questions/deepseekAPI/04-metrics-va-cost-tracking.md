# Phase 4: Metrics & Cost Tracking

> **Mục tiêu:** Có thể quan sát, đo lường và tối ưu chi phí DeepSeek API
> **Độ phức tạp:** Thấp-Trung bình | **Risk:** Thấp | **Kỳ vọng:** Observable, cost-aware

---

## 4.1 Hiện trạng — Không có metrics, cost = 0

### File: `DocumentQuestionJobService.java` (line 114)

```java
.estimatedCostUsd(0.0)  // ← Luôn = 0, không tính thực tế!
```

### File: `DeepSeekDocumentQuestionGenerator.java`

```java
// Chỉ có log, không có metrics:
log.info("DeepSeek call completed stage={} attempt={} latencyMs={} promptTokens={} completionTokens={} totalTokens={}",
    stage, attempt + 1, latencyMs, promptTokens, completionTokens, totalTokens);
```

### Vấn đề:
- Không biết chi phí thực tế mỗi lần generate
- Không có latency histogram → không phát hiện degradation
- Không có error rate metrics → không alert được
- Log là text → khó aggregate, không visualize được
- `estimatedCostUsd` luôn = 0 trong DB

---

## 4.2 Giải pháp 1: Micrometer Metrics

### Dependency:

```groovy
// build.gradle
implementation 'io.micrometer:micrometer-core'
implementation 'io.micrometer:micrometer-registry-prometheus'  // Nếu dùng Prometheus
```

### Implementation:

**File mới: `generation/DeepSeekMetrics.java`**

```java
package vn.vietduc.carehubbackend.questiongeneration.generation;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class DeepSeekMetrics {
    private final MeterRegistry registry;

    // Counters
    private final Counter callsTotal;
    private final Counter callsSuccess;
    private final Counter callsFailed;
    private final Counter tokensPrompt;
    private final Counter tokensCompletion;
    private final Counter tokensTotal;

    // Timers
    private final Timer callLatency;

    // Gauges
    private final AtomicInteger circuitState;  // 0=CLOSED, 1=OPEN, 2=HALF_OPEN
    private final AtomicInteger activePermits;

    public DeepSeekMetrics(MeterRegistry registry) {
        this.registry = registry;

        this.callsTotal = Counter.builder("deepseek.calls.total")
            .description("Total DeepSeek API calls")
            .register(registry);

        this.callsSuccess = Counter.builder("deepseek.calls.success")
            .description("Successful DeepSeek API calls")
            .register(registry);

        this.callsFailed = Counter.builder("deepseek.calls.failed")
            .description("Failed DeepSeek API calls")
            .tag("error_type", "unknown")  // Will be overridden per-call
            .register(registry);

        this.tokensPrompt = Counter.builder("deepseek.tokens.prompt")
            .description("Total prompt tokens sent")
            .register(registry);

        this.tokensCompletion = Counter.builder("deepseek.tokens.completion")
            .description("Total completion tokens received")
            .register(registry);

        this.tokensTotal = Counter.builder("deepseek.tokens.total")
            .description("Total tokens used")
            .register(registry);

        this.callLatency = Timer.builder("deepseek.call.latency")
            .description("DeepSeek API call latency")
            .publishPercentiles(0.5, 0.95, 0.99)
            .register(registry);

        this.circuitState = new AtomicInteger(0);
        registry.gauge("deepseek.circuit.state", circuitState);

        this.activePermits = new AtomicInteger(0);
        registry.gauge("deepseek.semaphore.active", activePermits);
    }

    public void recordCall(String stage, String model, boolean success,
                           int promptTokens, int completionTokens, long latencyMs,
                           String errorType) {
        callsTotal.increment();
        if (success) {
            callsSuccess.increment();
        } else {
            callsFailed.increment();  // Tag với error_type nếu cần
        }
        tokensPrompt.increment(promptTokens);
        tokensCompletion.increment(completionTokens);
        tokensTotal.increment(promptTokens + completionTokens);
        callLatency.record(latencyMs, TimeUnit.MILLISECONDS);
    }

    public void setCircuitState(int state) { circuitState.set(state); }
    public void setActivePermits(int permits) { activePermits.set(permits); }
}
```

### Tích hợp vào `DeepSeekDocumentQuestionGenerator`:

```java
// Trong callDeepSeek():
long latencyMs = Duration.between(started, Instant.now()).toMillis();
metrics.recordCall(stage, model, true,
    valueOrZero(usage.promptTokens()),
    valueOrZero(usage.completionTokens()),
    latencyMs, null);

// Trong catch block:
metrics.recordCall(stage, model, false, 0, 0, latencyMs, errorType.name());
```

### Tích hợp semaphore gauge:

```java
// Trong callDeepSeek():
Semaphore semaphore = callSemaphore();
metrics.setActivePermits(properties.getMaxConcurrentCalls() - semaphore.availablePermits());
acquirePermit(semaphore, stage);
try {
    // ... API call ...
} finally {
    semaphore.release();
    metrics.setActivePermits(properties.getMaxConcurrentCalls() - semaphore.availablePermits());
}
```

---

## 4.3 Giải pháp 2: Cost Tracking

### DeepSeek pricing (tham khảo):
- `deepseek-v4-flash`: ~$0.14/1M input tokens, ~$0.56/1M output tokens
- `deepseek-v4-pro`: ~$0.55/1M input tokens, ~$2.20/1M output tokens

### Implementation:

**File: `AiGenerationProperties.java`**

```java
// Pricing per 1M tokens
private double inputPricePerMillion = 0.14;   // Default: flash input
private double outputPricePerMillion = 0.56;  // Default: flash output
private double fallbackInputPricePerMillion = 0.55;
private double fallbackOutputPricePerMillion = 2.20;
```

**File: `DeepSeekDocumentQuestionGenerator.java`** hoặc utility:

```java
public double estimateCost(String model, int promptTokens, int completionTokens) {
    double inputPrice = model.equals(properties.getFallbackModel())
        ? properties.getFallbackInputPricePerMillion()
        : properties.getInputPricePerMillion();
    double outputPrice = model.equals(properties.getFallbackModel())
        ? properties.getFallbackOutputPricePerMillion()
        : properties.getOutputPricePerMillion();

    return (promptTokens / 1_000_000.0) * inputPrice
         + (completionTokens / 1_000_000.0) * outputPrice;
}
```

### Lưu cost vào DB:

**File: `DocumentQuestionJobService.java`** — Cập nhật khi apply result:

```java
// Trong applyResult() hoặc persistCandidates():
double callCost = estimateCost(generated.provider(), generated.model(),
    generated.usage().promptTokens(), generated.usage().completionTokens());
job.setEstimatedCostUsd(job.getEstimatedCostUsd() + callCost);
```

---

## 4.4 Giải pháp 3: Structured Logging với Trace ID

### Thêm trace ID vào mỗi job:

```java
// Trong DocumentQuestionJobService.createJob():
String traceId = UUID.randomUUID().toString().substring(0, 8);
job.setTraceId(traceId);  // Thêm cột trace_id vào entity

// Trong tất cả log statement:
log.info("[trace={}] DeepSeek call completed stage={} ...", traceId, stage, ...);
```

### Entity update:

**File: `DocumentQuestionJob.java`**

```java
@Column(name = "trace_id", length = 16)
private String traceId;
```

---

## 4.5 Health Check Endpoint

**File: `AiModelRuntimeStatusService.java`** — Đã có endpoint `/ai-model-runtime/status`. Cần bổ sung:

```java
private AiModelRuntimeStatusResponse.ModelStatus generationStatus() {
    // ... existing logic ...
    // Bổ sung:
    // - Circuit breaker state
    // - Active semaphore permits
    // - Error rate (last 5 min)
    // - Average latency (last 5 min)
}
```

---

## 4.6 Dashboard (Prometheus + Grafana — optional)

Các metric nên visualize:

| Panel | Metric | Type |
|---|---|---|
| Call rate | `rate(deepseek.calls.total[5m])` | Graph |
| Error rate | `rate(deepseek.calls.failed[5m]) / rate(deepseek.calls.total[5m])` | Graph |
| P95 latency | `histogram_quantile(0.95, deepseek.call.latency)` | Graph |
| Token usage | `rate(deepseek.tokens.total[5m])` | Graph |
| Cost per hour | `rate(deepseek.tokens.prompt[1h]) * $0.14/1M + ...` | Stat |
| Circuit state | `deepseek.circuit.state` | Gauge |
| Active permits | `deepseek.semaphore.active` | Gauge |

---

## 4.7 Cost Estimation Table

**File: `application.yaml`**

```yaml
ai:
  generation:
    # Pricing (per 1M tokens)
    input-price-per-million: ${GENERATION_INPUT_PRICE:0.14}
    output-price-per-million: ${GENERATION_OUTPUT_PRICE:0.56}
    fallback-input-price-per-million: ${GENERATION_FALLBACK_INPUT_PRICE:0.55}
    fallback-output-price-per-million: ${GENERATION_FALLBACK_OUTPUT_PRICE:2.20}
```

---

## 4.8 Files cần sửa

| File | Thay đổi |
|---|---|
| `generation/DeepSeekMetrics.java` | **File mới** — Micrometer metrics |
| `DeepSeekDocumentQuestionGenerator.java` | Ghi metrics, tính cost |
| `DocumentQuestionJobService.java` | Lưu `estimatedCostUsd` thực tế |
| `DocumentQuestionJob.java` | Thêm cột `trace_id` |
| `AiGenerationProperties.java` | Thêm pricing config |
| `AiModelRuntimeStatusService.java` | Bổ sung health check info |
| `application.yaml` | Thêm pricing config |
| `build.gradle` | Thêm micrometer dependency |

---

## 4.9 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| Cost visibility | `estimatedCostUsd = 0` | **Giá trị thực tế** (ước tính) |
| Latency monitoring | Chỉ log | **Prometheus histogram + P95/P99** |
| Error alerting | Không | **Có thể alert khi error rate > threshold** |
| Debugging | Log text rời rạc | **Trace ID xuyên suốt** |
| Health check | Cơ bản | **CB state, active permits, error rate** |

---

## 4.10 Risk assessment

- **Micrometer dependency**: Nhẹ, đã là standard trong Spring Boot ecosystem
- **Prometheus endpoint**: Cần secure (nếu expose ra ngoài)
- **Cost estimation**: Là ước tính, không phải billing chính xác từ DeepSeek
- **Performance overhead của metrics**: Không đáng kể (vài microsecond/call)
