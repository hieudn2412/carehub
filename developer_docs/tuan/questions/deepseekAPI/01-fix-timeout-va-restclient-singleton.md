# Phase 1: Fix Timeout & RestClient Singleton

> **Mục tiêu:** Sửa các lỗi có thể gây treo request vĩnh viễn + tối ưu HTTP client
> **Độ phức tạp:** Thấp | **Risk:** Rất thấp | **Kỳ vọng:** Hết treo request, connection pool

---

## 1.1 Vấn đề 1: RestClient không có timeout

### File: `DeepSeekDocumentQuestionGenerator.java` (lines 47-58)

```java
@Override
public GeneratedChunkResult generate(GenerationInput input) {
    requireApiKey();
    RestClient client = RestClient.builder()
            .baseUrl(properties.getApiBaseUrl())
            .build();  // ← KHÔNG set timeout!
    // ...
}
```

### Vấn đề:
- `properties.getTimeoutSeconds()` = 60 đã được khai báo nhưng **không được dùng**
- `RestClient` mặc định không có timeout → request có thể treo vô hạn
- Nếu DeepSeek API chậm hoặc network issue → thread bị kẹt vĩnh viễn

### Fix:

```java
private RestClient buildRestClient() {
    HttpClient httpClient = HttpClient.create(ConnectionProvider.builder("deepseek")
            .maxConnections(properties.getMaxConnections())
            .pendingAcquireMaxCount(properties.getMaxConcurrentCalls() * 2)
            .build());

    return RestClient.builder()
            .baseUrl(properties.getApiBaseUrl())
            .requestFactory(new JdkClientHttpRequestFactory(httpClient))
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .requestInitializer(request -> {
                // Timeout per request
                request.getAttributes()
                    .put(ClientHttpRequestAttributes.REQUEST_TIMEOUT,
                         Duration.ofSeconds(properties.getTimeoutSeconds()));
            })
            .build();
}
```

Hoặc dùng `SimpleClientHttpRequestFactory` đơn giản hơn:

```java
private RestClient buildRestClient() {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(Duration.ofSeconds(10));    // Connect timeout
    factory.setReadTimeout(Duration.ofSeconds(properties.getTimeoutSeconds()));  // Read timeout

    return RestClient.builder()
            .baseUrl(properties.getApiBaseUrl())
            .requestFactory(factory)
            .build();
}
```

---

## 1.2 Vấn đề 2: RestClient tạo mới mỗi lần gọi

### File: `DeepSeekDocumentQuestionGenerator.java` (lines 47-58)

```java
public GeneratedChunkResult generate(GenerationInput input) {
    // ...
    RestClient client = RestClient.builder()  // ← Tạo mới MỖI LẦN generate()!
            .baseUrl(properties.getApiBaseUrl())
            .build();
    // ...
}
```

### Vấn đề:
- Mỗi chunk text → 1-3 API calls (tùy pipeline mode) → tạo RestClient mới mỗi lần
- Mất connection pooling, không reuse TCP connection
- GC pressure từ object allocation không cần thiết
- Không tận dụng được HTTP keep-alive

### Fix — Singleton RestClient:

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class DeepSeekDocumentQuestionGenerator implements DocumentQuestionGenerator {
    // ... fields ...

    private volatile RestClient restClient;  // ← Singleton

    private RestClient restClient() {
        RestClient client = restClient;
        if (client == null) {
            synchronized (this) {
                if (restClient == null) {
                    restClient = buildRestClient();
                }
                client = restClient;
            }
        }
        return client;
    }

    @Override
    public GeneratedChunkResult generate(GenerationInput input) {
        requireApiKey();
        RestClient client = restClient();  // ← Dùng singleton

        if (PIPELINE_SINGLE_CALL.equalsIgnoreCase(properties.getPipelineMode())) {
            return generateSingleCall(client, input);
        }
        return generateMultiStage(client, input);
    }
    // ...
}
```

---

## 1.3 Vấn đề 3: Semaphore.acquire() không timeout

### File: `DeepSeekDocumentQuestionGenerator.java` (lines 384-391)

```java
private void acquirePermit(Semaphore semaphore, String stage) {
    try {
        semaphore.acquire();  // ← Block VĨNH VIỄN nếu không có permit!
    } catch (InterruptedException ex) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Bị ngắt khi chờ giới hạn gọi DeepSeek stage=" + stage, ex);
    }
}
```

### Vấn đề:
- Nếu tất cả permits bị kẹt (do không có timeout ở HTTP level) → thread chờ mãi mãi
- Không cách nào recover ngoài restart app

### Fix:

```java
private void acquirePermit(Semaphore semaphore, String stage) {
    try {
        long acquireTimeoutSeconds = Math.max(1, properties.getTimeoutSeconds() * 2);
        boolean acquired = semaphore.tryAcquire(acquireTimeoutSeconds, TimeUnit.SECONDS);
        if (!acquired) {
            throw new IllegalStateException(
                "Không acquire được DeepSeek semaphore sau " + acquireTimeoutSeconds +
                "s. All " + properties.getMaxConcurrentCalls() + " permits are busy. " +
                "Stage=" + stage);
        }
    } catch (InterruptedException ex) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Bị ngắt khi chờ giới hạn gọi DeepSeek stage=" + stage, ex);
    }
}
```

---

## 1.4 Vấn đề 4: callSemaphore() double-checked locking dư thừa

### File: `DeepSeekDocumentQuestionGenerator.java` (lines 369-382)

```java
private Semaphore callSemaphore() {
    int permits = Math.max(1, properties.getMaxConcurrentCalls());
    Semaphore current = callSemaphore;
    if (current == null || callSemaphorePermits != permits) {
        synchronized (this) {
            if (callSemaphore == null || callSemaphorePermits != permits) {
                callSemaphore = new Semaphore(permits);
                callSemaphorePermits = permits;
            }
            current = callSemaphore;
        }
    }
    return current;
}
```

### Vấn đề:
- `properties.getMaxConcurrentCalls()` được gọi 2 lần (line 370, 374) → nếu config thay đổi runtime, 2 lần gọi có thể trả về khác nhau
- Double-checked locking đúng nhưng phức tạp không cần thiết

### Fix — Đơn giản hóa:

```java
private Semaphore callSemaphore() {
    int permits = Math.max(1, properties.getMaxConcurrentCalls());
    Semaphore current = this.callSemaphore;
    if (current != null && this.callSemaphorePermits == permits) {
        return current;
    }
    synchronized (this) {
        // Re-check inside lock
        if (this.callSemaphore == null || this.callSemaphorePermits != permits) {
            this.callSemaphore = new Semaphore(permits);
            this.callSemaphorePermits = permits;
        }
        return this.callSemaphore;
    }
}
```

---

## 1.5 Config bổ sung

**File: `AiGenerationProperties.java`**

```java
private int maxConnections = 10;           // Max HTTP connections trong pool
private int connectTimeoutSeconds = 10;    // Timeout kết nối TCP
// private int timeoutSeconds = 60;        // Đã có — read timeout
// private int maxConcurrentCalls = 2;     // Đã có — semaphore permits
```

**File: `application.yaml`**

```yaml
ai:
  generation:
    max-connections: ${GENERATION_MAX_CONNECTIONS:10}
    connect-timeout-seconds: ${GENERATION_CONNECT_TIMEOUT_SECONDS:10}
    # timeout-seconds: Đã có (read timeout)
    # max-concurrent-calls: Đã có (semaphore)
```

---

## 1.6 Files cần sửa

| File | Thay đổi |
|---|---|
| `DeepSeekDocumentQuestionGenerator.java` | Singleton RestClient, timeout, semaphore timeout, đơn giản hóa callSemaphore |
| `AiGenerationProperties.java` | Thêm `maxConnections`, `connectTimeoutSeconds` |
| `application.yaml` | Thêm config connections |

---

## 1.7 Kỳ vọng kết quả

| Metric | Trước | Sau |
|---|---|---|
| HTTP timeout | ❌ Không có → treo vĩnh viễn | ✅ Connect 10s + Read 60s |
| Semaphore timeout | ❌ Block vĩnh viễn | ✅ Throw exception sau 120s |
| Connection pool | ❌ Mỗi request tạo mới | ✅ Pool 10 connections, reuse |
| Object allocation/generate() | 1 RestClient mới | 0 (singleton) |
| Code clarity (callSemaphore) | Double-checked phức tạp | Đơn giản hóa |

---

## 1.8 Risk assessment

- **Thay đổi RestClient từ per-call → singleton**: Không rủi ro vì RestClient thread-safe
- **Thêm timeout**: Cần chọn giá trị hợp lý. 60s đủ cho DeepSeek API (thường respond < 10s)
- **Semaphore timeout 120s**: Đủ dài để không fail legitimate requests đang chờ, đủ ngắn để không block vĩnh viễn
