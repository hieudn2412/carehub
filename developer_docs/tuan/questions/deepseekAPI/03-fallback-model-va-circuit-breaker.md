# Phase 3: Fallback Model & Circuit Breaker Nâng Cao

> **Mục tiêu:** Tăng resilience — fallback model, circuit breaker half-open, error classification
> **Độ phức tạp:** Trung bình | **Risk:** Trung bình | **Kỳ vọng:** Giảm failure rate, tự recovery

---

## 3.1 Hiện trạng — Circuit breaker cơ bản, không fallback

### Circuit breaker hiện tại:

```java
// File: DeepSeekDocumentQuestionGenerator.java
private final AtomicInteger consecutiveFailures = new AtomicInteger();
private volatile Instant circuitOpenUntil = Instant.EPOCH;

private void recordFailure() {
    int failures = consecutiveFailures.incrementAndGet();
    if (failures >= Math.max(1, properties.getCircuitBreakerFailureThreshold())) {
        circuitOpenUntil = Instant.now()
            .plusSeconds(Math.max(1, properties.getCircuitBreakerCooldownSeconds()));
        consecutiveFailures.set(0);
        log.warn("DeepSeek circuit breaker opened until={}", circuitOpenUntil);
    }
}
```

### Vấn đề:
1. **Không có half-open state**: Sau cooldown, circuit đóng hoàn toàn. Nếu API vẫn lỗi → lại mở sau N failures → chu kỳ lặp
2. **Không phân biệt loại lỗi**: Rate limit (429) vs auth error (401) vs server error (500) — tất cả đều tính là failure
3. **`fallbackModel` không được dùng**: Config có `fallbackModel = "deepseek-v4-pro"` nhưng không có code fallback
4. **Retry cùng 1 model**: Retry logic chỉ gọi lại cùng model, không thử model khác

---

## 3.2 Giải pháp 1: Half-open Circuit Breaker

### State machine:

```
CLOSED ──(N consecutive failures)──► OPEN
  │                                    │
  │                                    │ (cooldown expires)
  │                                    ▼
  │                              HALF_OPEN
  │                                    │
  │                      ┌─────────────┼─────────────┐
  │                      │ (success)   │ (failure)   │
  │                      ▼             ▼             │
  └────────────────── CLOSED         OPEN ◄──────────┘
```

### Implementation:

```java
private enum CircuitState { CLOSED, OPEN, HALF_OPEN }

private volatile CircuitState circuitState = CircuitState.CLOSED;
private final AtomicInteger failureCount = new AtomicInteger();
private final AtomicInteger halfOpenProbeCount = new AtomicInteger();
private volatile Instant stateChangedAt = Instant.now();

private static final int HALF_OPEN_MAX_PROBES = 2;

private void checkCircuitBreaker() {
    CircuitState state = circuitState;
    Instant now = Instant.now();

    switch (state) {
        case CLOSED:
            return;  // Cho phép

        case OPEN:
            long cooldownSeconds = properties.getCircuitBreakerCooldownSeconds();
            if (now.isAfter(stateChangedAt.plusSeconds(cooldownSeconds))) {
                // Transition to HALF_OPEN
                circuitState = CircuitState.HALF_OPEN;
                halfOpenProbeCount.set(0);
                stateChangedAt = now;
                log.info("DeepSeek circuit breaker: OPEN → HALF_OPEN");
                return;  // Cho phép probe
            }
            throw new IllegalStateException(
                "DeepSeek circuit breaker OPEN đến " +
                stateChangedAt.plusSeconds(cooldownSeconds));

        case HALF_OPEN:
            if (halfOpenProbeCount.incrementAndGet() <= HALF_OPEN_MAX_PROBES) {
                return;  // Cho phép probe
            }
            throw new IllegalStateException(
                "DeepSeek circuit breaker HALF_OPEN, đã đạt max probes=" +
                HALF_OPEN_MAX_PROBES);
    }
}

private void recordSuccess() {
    CircuitState state = circuitState;
    if (state == CircuitState.HALF_OPEN) {
        // Probe success → close circuit
        circuitState = CircuitState.CLOSED;
        failureCount.set(0);
        stateChangedAt = Instant.now();
        log.info("DeepSeek circuit breaker: HALF_OPEN → CLOSED (probe succeeded)");
    } else if (state == CircuitState.CLOSED) {
        failureCount.set(0);  // Reset counter on success
    }
}

private void recordFailure(DeepSeekErrorType errorType) {
    if (errorType == DeepSeekErrorType.AUTHENTICATION) {
        // Auth errors không nên trigger circuit breaker
        log.error("DeepSeek authentication error — check API key");
        return;
    }
    if (errorType == DeepSeekErrorType.RATE_LIMIT) {
        // Rate limit → backoff nhưng không mở circuit ngay
        log.warn("DeepSeek rate limited, backing off");
    }

    CircuitState state = circuitState;
    if (state == CircuitState.HALF_OPEN) {
        // Probe failed → back to OPEN
        circuitState = CircuitState.OPEN;
        stateChangedAt = Instant.now();
        log.warn("DeepSeek circuit breaker: HALF_OPEN → OPEN (probe failed)");
        return;
    }

    int failures = failureCount.incrementAndGet();
    if (state == CircuitState.CLOSED &&
        failures >= properties.getCircuitBreakerFailureThreshold()) {
        circuitState = CircuitState.OPEN;
        stateChangedAt = Instant.now();
        log.warn("DeepSeek circuit breaker: CLOSED → OPEN ({} consecutive failures)", failures);
    }
}
```

---

## 3.3 Giải pháp 2: Fallback Model

### Khi nào fallback:
1. Primary model trả về lỗi (sau khi retry hết)
2. Primary model bị rate limit → dùng fallback model (khác rate limit bucket)
3. Circuit breaker OPEN cho primary → thử fallback trước khi fail hoàn toàn

### Implementation:

```java
@RequiredArgsConstructor
public class DeepSeekDocumentQuestionGenerator implements DocumentQuestionGenerator {
    private final AiGenerationProperties properties;
    // ...

    @Override
    public GeneratedChunkResult generate(GenerationInput input) {
        requireApiKey();
        RestClient client = restClient();

        // Thử primary model
        try {
            return generateWithModel(client, input, properties.getModel());
        } catch (RetryableException ex) {
            if (properties.getFallbackModel() != null &&
                !properties.getFallbackModel().isBlank() &&
                !properties.getFallbackModel().equals(properties.getModel())) {

                log.warn("Primary model {} failed, trying fallback model {}: {}",
                    properties.getModel(), properties.getFallbackModel(), ex.getMessage());

                try {
                    return generateWithModel(client, input, properties.getFallbackModel());
                } catch (Exception fallbackEx) {
                    throw new IllegalStateException(
                        "Cả primary model " + properties.getModel() +
                        " và fallback model " + properties.getFallbackModel() +
                        " đều thất bại", fallbackEx);
                }
            }
            throw ex;
        }
    }

    private GeneratedChunkResult generateWithModel(RestClient client, GenerationInput input, String model) {
        if (PIPELINE_SINGLE_CALL.equalsIgnoreCase(properties.getPipelineMode())) {
            DeepSeekCall call = callDeepSeek("single_call", client, singleCallMessages(input), model);
            return parseSingleCallResult(call.content(), call.usage());
        }
        return generateMultiStageWithModel(client, input, model);
    }

    private DeepSeekCall callDeepSeek(String stage, RestClient client,
                                        List<Map<String, String>> messages,
                                        String model) {
        // ... giống callDeepSeek hiện tại, nhưng model là tham số thay vì properties.getModel()
    }
}
```

### Config:

**File: `AiGenerationProperties.java`**

```java
private boolean fallbackEnabled = true;  // Feature flag cho fallback model
```

**File: `application.yaml`**

```yaml
ai:
  generation:
    fallback-enabled: ${GENERATION_FALLBACK_ENABLED:true}
```

---

## 3.4 Giải pháp 3: Error Classification

Phân biệt loại lỗi để circuit breaker và retry có behavior khác nhau:

```java
private enum DeepSeekErrorType {
    AUTHENTICATION,   // 401 — Không retry, không trigger CB
    RATE_LIMIT,       // 429 — Retry với backoff dài hơn
    SERVER_ERROR,     // 5xx — Retry, trigger CB
    TIMEOUT,          // Timeout — Retry, trigger CB
    PARSE_ERROR,      // Response không parse được — Retry ít hơn
    UNKNOWN           // Default
}

private DeepSeekErrorType classifyError(Throwable ex, int httpStatus) {
    return switch (httpStatus) {
        case 401, 403 -> DeepSeekErrorType.AUTHENTICATION;
        case 429 -> DeepSeekErrorType.RATE_LIMIT;
        case 500, 502, 503, 504 -> DeepSeekErrorType.SERVER_ERROR;
        default -> ex instanceof TimeoutException
            ? DeepSeekErrorType.TIMEOUT
            : DeepSeekErrorType.UNKNOWN;
    };
}
```

**Retry policy theo error type:**

```java
private int retryCountFor(DeepSeekErrorType errorType) {
    return switch (errorType) {
        case AUTHENTICATION -> 0;     // Không retry
        case RATE_LIMIT -> 3;         // Retry nhiều lần với backoff
        case SERVER_ERROR -> properties.getMaxRetries();
        case TIMEOUT -> properties.getMaxRetries();
        case PARSE_ERROR -> 1;        // Retry 1 lần (có thể là transient)
        case UNKNOWN -> properties.getMaxRetries();
    };
}

private Duration retryBackoffFor(DeepSeekErrorType errorType, int attempt) {
    return switch (errorType) {
        case RATE_LIMIT -> Duration.ofSeconds((long) Math.pow(2, attempt + 2));  // 4s, 8s, 16s
        case SERVER_ERROR -> Duration.ofMillis(500 * (long) Math.pow(2, attempt));
        default -> Duration.ofMillis(200 * (long) Math.pow(2, attempt));
    };
}
```

---

## 3.5 Prompt Optimization (Bonus)

### Vấn đề: System prompt giống hệt nhau mỗi lần gọi

Mỗi API call gửi lại toàn bộ system prompt (~500-800 tokens). Có thể tiết kiệm bằng:

**1. Cache system prompt hash** để DeepSeek nhận diện (nếu API hỗ trợ prompt caching):

```java
// DeepSeek API có thể hỗ trợ prompt caching nếu content hash matches
// Gửi header hint (nếu API hỗ trợ)
```

**2. Dùng single_call pipeline** (đã có) giúp giảm số lần gửi system prompt.

**3. Prompt template constants** — extract ra constant để tránh string allocation:

```java
// Hiện tại: text block trong method → tạo mới mỗi lần
// Nên: static final String constants

private static final String SYSTEM_PROMPT_SINGLE_CALL = """
    Bạn là hệ thống tạo câu hỏi trắc nghiệm một đáp án cho đào tạo bệnh viện.
    ...
    """;

private static final String USER_PROMPT_SINGLE_CALL = """
    Section path: %s
    
    Chunk:
    %s
    
    Hãy trích xuất 0-8 knowledge point và tạo tối đa %d câu hỏi...
    """;
```

---

## 3.6 Files cần sửa

| File | Thay đổi |
|---|---|
| `DeepSeekDocumentQuestionGenerator.java` | Half-open CB, fallback model, error classification, retry policy, prompt constants |
| `AiGenerationProperties.java` | Thêm `fallbackEnabled` |
| `application.yaml` | Thêm config fallback |

---

## 3.7 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| CB states | CLOSED ↔ OPEN | CLOSED → OPEN → HALF_OPEN → CLOSED |
| Auth error handling | Trigger CB (sai) | Không trigger CB, log error |
| Rate limit handling | Retry như nhau | Retry với backoff dài hơn |
| Model failure recovery | Fail hoàn toàn | Fallback sang model khác |
| Recovery time khi API ổn định lại | Đến hết cooldown | Probe thành công → đóng ngay |

---

## 3.8 Risk assessment

- **Fallback model cost**: `deepseek-v4-pro` đắt hơn `deepseek-v4-flash` ~3-5x. Cần alert khi fallback được dùng nhiều
- **Half-open probe có thể fail**: Nếu API vẫn chưa ổn định → probe fail → quay lại OPEN. Đây là behavior đúng
- **Error classification**: Cần test với DeepSeek API thực tế để verify HTTP status codes
