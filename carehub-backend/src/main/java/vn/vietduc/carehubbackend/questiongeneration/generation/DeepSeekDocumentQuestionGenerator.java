package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@Slf4j
public class DeepSeekDocumentQuestionGenerator implements DocumentQuestionGenerator {
    private static final String PIPELINE_SINGLE_CALL = "single_call";
    private static final String PIPELINE_MULTI_STAGE = "multi_stage";

    private final AiGenerationProperties properties;
    private final ObjectMapper objectMapper;
    private volatile CircuitState circuitState = CircuitState.CLOSED;
    private final AtomicInteger failureCount = new AtomicInteger();
    private final AtomicInteger halfOpenProbeCount = new AtomicInteger();
    private volatile Instant stateChangedAt = Instant.now();
    private volatile Semaphore callSemaphore;
    private volatile int callSemaphorePermits;
    private volatile RestClient restClient;

    private enum CircuitState { CLOSED, OPEN, HALF_OPEN }

    private enum DeepSeekErrorType {
        AUTHENTICATION, RATE_LIMIT, SERVER_ERROR, TIMEOUT, PARSE_ERROR, UNKNOWN
    }

    public DeepSeekDocumentQuestionGenerator(AiGenerationProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public String provider() {
        return "api";
    }

    private RestClient restClient() {
        RestClient client = this.restClient;
        if (client == null) {
            synchronized (this) {
                if (this.restClient == null) {
                    this.restClient = buildRestClient();
                }
                client = this.restClient;
            }
        }
        return client;
    }

    private RestClient buildRestClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(properties.getConnectTimeoutSeconds()));
        factory.setReadTimeout(Duration.ofSeconds(properties.getTimeoutSeconds()));

        return RestClient.builder()
                .baseUrl(properties.getApiBaseUrl())
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public GeneratedChunkResult generate(GenerationInput input) {
        requireApiKey();
        RestClient client = restClient();

        try {
            if (PIPELINE_SINGLE_CALL.equalsIgnoreCase(properties.getPipelineMode())) {
                return generateSingleCallWithModel(client, input, properties.getModel());
            }
            return generateMultiStageWithModel(client, input, properties.getModel());
        } catch (RuntimeException ex) {
            String fallbackModel = properties.getFallbackModel();
            if (fallbackModel == null || fallbackModel.isBlank()
                    || fallbackModel.equals(properties.getModel())) {
                throw ex;
            }
            log.warn("Primary model {} failed, trying fallback model {}: {}",
                    properties.getModel(), fallbackModel, ex.getMessage());
            try {
                if (PIPELINE_SINGLE_CALL.equalsIgnoreCase(properties.getPipelineMode())) {
                    return generateSingleCallWithModel(client, input, fallbackModel);
                }
                return generateMultiStageWithModel(client, input, fallbackModel);
            } catch (RuntimeException fallbackEx) {
                throw new IllegalStateException(
                        "Cả primary model " + properties.getModel()
                                + " và fallback model " + fallbackModel + " đều thất bại", fallbackEx);
            }
        }
    }

    private GeneratedChunkResult generateSingleCallWithModel(RestClient client, GenerationInput input, String model) {
        DeepSeekCall call = callDeepSeek("single_call", client, singleCallMessages(input), model);
        return parseSingleCallResult(call.content(), call.usage());
    }

    private GeneratedChunkResult generateMultiStageWithModel(RestClient client, GenerationInput input, String model) {
        DeepSeekCall knowledgeCall = callDeepSeek("knowledge", client, knowledgeMessages(input), model);
        List<GeneratedKnowledgePoint> knowledgePoints = parseKnowledgePoints(knowledgeCall.content());
        if (knowledgePoints.stream().noneMatch(GeneratedKnowledgePoint::generationEligible)) {
            return new GeneratedChunkResult(
                    provider(),
                    model,
                    properties.getPromptVersion(),
                    knowledgeCall.usage(),
                    knowledgePoints,
                    List.of()
            );
        }

        DeepSeekCall questionCall = callDeepSeek("questions", client, questionMessages(input, knowledgePoints), model);
        List<GeneratedQuestion> questions = parseQuestions(questionCall.content());
        LlmUsage usage = knowledgeCall.usage().plus(questionCall.usage());

        if (properties.isLlmValidationEnabled()) {
            List<GeneratedQuestion> validated = new ArrayList<>();
            for (GeneratedQuestion question : questions) {
                DeepSeekCall validationCall = callDeepSeek("validation", client, validationMessages(input, question), model);
                usage = usage.plus(validationCall.usage());
                validated.add(withValidation(question, validationCall.content()));
            }
            questions = validated;
        }

        return new GeneratedChunkResult(
                provider(),
                model,
                properties.getPromptVersion(),
                usage,
                knowledgePoints,
                questions
        );
    }

    GeneratedChunkResult parseSingleCallResult(String json, LlmUsage usage) {
        List<GeneratedKnowledgePoint> knowledgePoints = parseKnowledgePoints(json);
        List<GeneratedQuestion> questions = parseQuestions(json);
        if (knowledgePoints.stream().noneMatch(GeneratedKnowledgePoint::generationEligible)) {
            questions = List.of();
        }
        return new GeneratedChunkResult(
                provider(),
                properties.getModel(),
                properties.getPromptVersion(),
                usage,
                knowledgePoints,
                questions
        );
    }

    private List<Map<String, String>> singleCallMessages(GenerationInput input) {
        return List.of(
                Map.of(
                        "role", "system",
                        "content", """
                                Bạn là hệ thống tạo câu hỏi trắc nghiệm một đáp án cho đào tạo bệnh viện.
                                Chỉ dựa vào chunk được cung cấp. Không suy diễn ngoài nguồn.
                                Câu hỏi, đáp án và giải thích phải bằng tiếng Việt, giữ nguyên thuật ngữ chuyên môn tiếng Anh khi cần.
                                Stem phải tự đứng độc lập: người đọc hiểu và trả lời được mà không cần nhìn section path, chunk hoặc tài liệu gốc.
                                Cấm bắt đầu stem bằng "Theo tài liệu", "Dựa vào tài liệu", "Trong tài liệu", "Theo nội dung trên" hoặc hỏi "nhận định nào phù hợp với mục...".
                                Không dùng các lựa chọn kiểu "tất cả đều đúng", "cả A và B", "không có đáp án nào".
                                Mỗi câu phải có đúng một đáp án tốt nhất và có sourceExcerpt xuất hiện nguyên văn trong chunk.
                                Nếu chunk không đủ thông tin kiểm tra độc lập, trả về knowledgePoints phù hợp nhưng questions là mảng rỗng.
                                Trả về JSON hợp lệ, không bọc markdown.
                                """
                ),
                Map.of(
                        "role", "user",
                        "content", """
                                Section path: %s

                                Chunk:
                                %s

                                Hãy trích xuất 0-8 knowledge point và tạo tối đa %d câu hỏi single-choice từ các knowledge point đủ điều kiện.
                                Schema bắt buộc:
                                {
                                  "knowledgePoints": [
                                    {
                                      "id": "KP1",
                                      "statement": "mệnh đề kiến thức ngắn, rõ",
                                      "type": "definition|fact|procedure|warning|principle",
                                      "importance": "low|medium|high",
                                      "sourceExcerpt": "trích dẫn nguyên văn ngắn từ chunk",
                                      "generationEligible": true
                                    }
                                  ],
                                  "questions": [
                                    {
                                      "stem": "câu hỏi tự đứng độc lập, nêu rõ đối tượng/khái niệm/quy trình cần hỏi",
                                      "optionA": "phương án A",
                                      "optionB": "phương án B",
                                      "optionC": "phương án C",
                                      "optionD": "phương án D",
                                      "correctAnswer": "A",
                                      "explanation": "giải thích bám nguồn",
                                      "difficulty": "easy|medium|hard",
                                      "topic": "chủ đề",
                                      "sourceExcerpt": "trích dẫn nguyên văn ngắn từ chunk",
                                      "knowledgePointId": "KP1"
                                    }
                                  ]
                                }
                                """.formatted(input.sectionPath(), input.chunkText(), input.questionsPerChunk())
                )
        );
    }

    private List<Map<String, String>> knowledgeMessages(GenerationInput input) {
        return List.of(
                Map.of(
                        "role", "system",
                        "content", """
                                Bạn là hệ thống trích xuất điểm kiến thức từ tài liệu y tế tiếng Việt.
                                Chỉ dựa vào chunk được cung cấp. Không suy diễn ngoài nguồn.
                                Trả về JSON hợp lệ, không bọc markdown.
                                """
                ),
                Map.of(
                        "role", "user",
                        "content", """
                                Section path: %s

                                Chunk:
                                %s

                                Hãy trích xuất 0-8 knowledge point dùng được để sinh câu hỏi một đáp án.
                                Schema bắt buộc:
                                {
                                  "knowledgePoints": [
                                    {
                                      "id": "KP1",
                                      "statement": "mệnh đề kiến thức ngắn, rõ",
                                      "type": "definition|fact|procedure|warning|principle",
                                      "importance": "low|medium|high",
                                      "sourceExcerpt": "trích dẫn nguyên văn ngắn từ chunk",
                                      "generationEligible": true
                                    }
                                  ]
                                }
                                """.formatted(input.sectionPath(), input.chunkText())
                )
        );
    }

    private List<Map<String, String>> questionMessages(GenerationInput input, List<GeneratedKnowledgePoint> knowledgePoints) {
        return List.of(
                Map.of(
                        "role", "system",
                        "content", """
                                Bạn là hệ thống tạo câu hỏi trắc nghiệm một đáp án cho đào tạo bệnh viện.
                                Câu hỏi, đáp án và giải thích phải bằng tiếng Việt, giữ nguyên thuật ngữ chuyên môn tiếng Anh khi cần.
                                Stem phải tự đứng độc lập: người đọc hiểu và trả lời được mà không cần nhìn section path, chunk hoặc tài liệu gốc.
                                Cấm bắt đầu stem bằng "Theo tài liệu", "Dựa vào tài liệu", "Trong tài liệu", "Theo nội dung trên" hoặc hỏi "nhận định nào phù hợp với mục...".
                                Không dùng các lựa chọn kiểu "tất cả đều đúng", "cả A và B", "không có đáp án nào".
                                Mỗi câu phải có đúng một đáp án tốt nhất và có sourceExcerpt xuất hiện trong chunk.
                                Trả về JSON hợp lệ, không bọc markdown.
                                """
                ),
                Map.of(
                        "role", "user",
                        "content", """
                                Section path: %s

                                Chunk:
                                %s

                                Knowledge points:
                                %s

                                Tạo tối đa %d câu hỏi single-choice.
                                Schema bắt buộc:
                                {
                                  "questions": [
                                    {
                                      "stem": "câu hỏi tự đứng độc lập, nêu rõ đối tượng/khái niệm/quy trình cần hỏi",
                                      "optionA": "phương án A",
                                      "optionB": "phương án B",
                                      "optionC": "phương án C",
                                      "optionD": "phương án D",
                                      "correctAnswer": "A",
                                      "explanation": "giải thích bám nguồn",
                                      "difficulty": "easy|medium|hard",
                                      "topic": "chủ đề",
                                      "sourceExcerpt": "trích dẫn nguyên văn ngắn từ chunk",
                                      "knowledgePointId": "KP1"
                                    }
                                  ]
                                }
                                """.formatted(input.sectionPath(), input.chunkText(), toJson(knowledgePoints), input.questionsPerChunk())
                )
        );
    }

    private List<Map<String, String>> validationMessages(GenerationInput input, GeneratedQuestion question) {
        return List.of(
                Map.of(
                        "role", "system",
                        "content", """
                                Bạn là validator câu hỏi trắc nghiệm y tế.
                                Chỉ đánh giá dựa trên chunk nguồn, không bổ sung kiến thức ngoài.
                                Trả về JSON hợp lệ, không bọc markdown.
                                """
                ),
                Map.of(
                        "role", "user",
                        "content", """
                                Chunk nguồn:
                                %s

                                Candidate:
                                %s

                                Kiểm tra câu hỏi có trả lời được từ nguồn, có đúng một đáp án tốt nhất và đáp án đúng được nguồn hỗ trợ không.
                                Schema:
                                {
                                  "answerable": true,
                                  "singleBestAnswer": true,
                                  "correctAnswerSupported": true,
                                  "qualityScore": 0.0,
                                  "issues": [],
                                  "rationale": "ngắn gọn"
                                }
                                """.formatted(input.chunkText(), toJson(question))
                )
        );
    }

    private DeepSeekCall callDeepSeek(String stage, RestClient client,
                                        List<Map<String, String>> messages, String model) {
        checkCircuitBreaker();
        Semaphore semaphore = callSemaphore();
        acquirePermit(semaphore, stage);
        DeepSeekErrorType lastErrorType = DeepSeekErrorType.UNKNOWN;
        RuntimeException lastError = null;
        int httpStatus = 0;
        try {
            int maxRetries = properties.getMaxRetries();
            for (int attempt = 0; attempt <= maxRetries; attempt++) {
                Instant started = Instant.now();
                try {
                    DeepSeekResponse response = client.post()
                            .uri("/chat/completions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey())
                            .body(Map.of(
                                    "model", model,
                                    "messages", messages,
                                    "temperature", properties.getTemperature(),
                                    "max_tokens", properties.getMaxOutputTokens(),
                                    "thinking", Map.of("type", "disabled"),
                                    "response_format", Map.of("type", "json_object")
                            ))
                            .retrieve()
                            .body(DeepSeekResponse.class);
                    long latencyMs = Duration.between(started, Instant.now()).toMillis();
                    if (response == null || response.choices() == null || response.choices().isEmpty()) {
                        throw new IllegalStateException("DeepSeek không trả về nội dung");
                    }
                    String content = response.choices().get(0).message().content();
                    Usage usage = response.usage();
                    recordSuccess();
                    log.info(
                            "DeepSeek call completed model={} stage={} attempt={} latencyMs={} promptTokens={} completionTokens={} totalTokens={}",
                            model,
                            stage,
                            attempt + 1,
                            latencyMs,
                            usage == null ? 0 : valueOrZero(usage.promptTokens()),
                            usage == null ? 0 : valueOrZero(usage.completionTokens()),
                            usage == null ? 0 : valueOrZero(usage.totalTokens())
                    );
                    return new DeepSeekCall(
                            sanitizeJson(content),
                            new LlmUsage(
                                    1,
                                    usage == null ? 0 : valueOrZero(usage.promptTokens()),
                                    usage == null ? 0 : valueOrZero(usage.completionTokens()),
                                    usage == null ? 0 : valueOrZero(usage.totalTokens()),
                                    latencyMs
                            )
                    );
                } catch (RuntimeException ex) {
                    long latencyMs = Duration.between(started, Instant.now()).toMillis();
                    lastErrorType = classifyError(ex, httpStatus);
                    log.warn(
                            "DeepSeek call failed model={} stage={} attempt={} latencyMs={} errorType={} message={}",
                            model, stage, attempt + 1, latencyMs, lastErrorType, ex.getMessage()
                    );
                    lastError = ex;
                    // Auth errors → không retry
                    if (lastErrorType == DeepSeekErrorType.AUTHENTICATION) {
                        break;
                    }
                    // Adaptive retry per error type
                    int typeRetries = retryCountFor(lastErrorType);
                    if (attempt >= typeRetries) {
                        break;
                    }
                    // Backoff
                    Duration backoff = retryBackoffFor(lastErrorType, attempt);
                    try {
                        Thread.sleep(backoff.toMillis());
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
            recordFailure(lastErrorType);
            throw lastError == null ? new IllegalStateException("Không gọi được DeepSeek") : lastError;
        } finally {
            semaphore.release();
        }
    }

    private Semaphore callSemaphore() {
        int permits = Math.max(1, properties.getMaxConcurrentCalls());
        Semaphore current = this.callSemaphore;
        if (current != null && this.callSemaphorePermits == permits) {
            return current;
        }
        synchronized (this) {
            if (this.callSemaphore == null || this.callSemaphorePermits != permits) {
                this.callSemaphore = new Semaphore(permits);
                this.callSemaphorePermits = permits;
            }
            return this.callSemaphore;
        }
    }

    private void acquirePermit(Semaphore semaphore, String stage) {
        try {
            long acquireTimeoutSeconds = Math.max(1, properties.getTimeoutSeconds() * 2L);
            boolean acquired = semaphore.tryAcquire(acquireTimeoutSeconds, TimeUnit.SECONDS);
            if (!acquired) {
                throw new IllegalStateException(
                        "Không acquire được DeepSeek semaphore sau " + acquireTimeoutSeconds
                                + "s. Tất cả " + properties.getMaxConcurrentCalls() + " permits đang bận. Stage=" + stage);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Bị ngắt khi chờ giới hạn gọi DeepSeek stage=" + stage, ex);
        }
    }

    // ── Half-open Circuit Breaker ──

    private static final int HALF_OPEN_MAX_PROBES = 2;

    private void checkCircuitBreaker() {
        CircuitState state = circuitState;
        Instant now = Instant.now();

        switch (state) {
            case CLOSED:
                return;

            case OPEN:
                long cooldownSeconds = Math.max(1, properties.getCircuitBreakerCooldownSeconds());
                if (now.isAfter(stateChangedAt.plusSeconds(cooldownSeconds))) {
                    circuitState = CircuitState.HALF_OPEN;
                    halfOpenProbeCount.set(0);
                    stateChangedAt = now;
                    log.info("DeepSeek circuit breaker: OPEN → HALF_OPEN");
                    return;
                }
                throw new IllegalStateException(
                        "DeepSeek circuit breaker OPEN đến "
                                + stateChangedAt.plusSeconds(cooldownSeconds));

            case HALF_OPEN:
                if (halfOpenProbeCount.incrementAndGet() <= HALF_OPEN_MAX_PROBES) {
                    return;
                }
                throw new IllegalStateException(
                        "DeepSeek circuit breaker HALF_OPEN, đã đạt max probes=" + HALF_OPEN_MAX_PROBES);
        }
    }

    private void recordSuccess() {
        CircuitState state = circuitState;
        if (state == CircuitState.HALF_OPEN) {
            circuitState = CircuitState.CLOSED;
            failureCount.set(0);
            stateChangedAt = Instant.now();
            log.info("DeepSeek circuit breaker: HALF_OPEN → CLOSED (probe succeeded)");
        } else if (state == CircuitState.CLOSED) {
            failureCount.set(0);
        }
    }

    private void recordFailure(DeepSeekErrorType errorType) {
        if (errorType == DeepSeekErrorType.AUTHENTICATION) {
            log.error("DeepSeek authentication error — check API key");
            return;
        }
        if (errorType == DeepSeekErrorType.RATE_LIMIT) {
            log.warn("DeepSeek rate limited, backing off");
        }

        CircuitState state = circuitState;
        if (state == CircuitState.HALF_OPEN) {
            circuitState = CircuitState.OPEN;
            stateChangedAt = Instant.now();
            log.warn("DeepSeek circuit breaker: HALF_OPEN → OPEN (probe failed)");
            return;
        }

        int failures = failureCount.incrementAndGet();
        if (state == CircuitState.CLOSED
                && failures >= Math.max(1, properties.getCircuitBreakerFailureThreshold())) {
            circuitState = CircuitState.OPEN;
            stateChangedAt = Instant.now();
            log.warn("DeepSeek circuit breaker: CLOSED → OPEN ({} consecutive failures)", failures);
        }
    }

    // ── Error Classification ──

    private DeepSeekErrorType classifyError(Throwable ex, int httpStatus) {
        return switch (httpStatus) {
            case 401, 403 -> DeepSeekErrorType.AUTHENTICATION;
            case 429 -> DeepSeekErrorType.RATE_LIMIT;
            case 500, 502, 503, 504 -> DeepSeekErrorType.SERVER_ERROR;
            default -> {
                if (ex instanceof java.net.SocketTimeoutException
                        || ex instanceof java.util.concurrent.TimeoutException) {
                    yield DeepSeekErrorType.TIMEOUT;
                }
                if (ex instanceof IllegalStateException
                        && ex.getMessage() != null
                        && ex.getMessage().contains("JSON")) {
                    yield DeepSeekErrorType.PARSE_ERROR;
                }
                yield DeepSeekErrorType.UNKNOWN;
            }
        };
    }

    private int retryCountFor(DeepSeekErrorType errorType) {
        return switch (errorType) {
            case AUTHENTICATION -> 0;
            case RATE_LIMIT -> 3;
            case SERVER_ERROR, TIMEOUT, UNKNOWN -> properties.getMaxRetries();
            case PARSE_ERROR -> 1;
        };
    }

    private Duration retryBackoffFor(DeepSeekErrorType errorType, int attempt) {
        return switch (errorType) {
            case RATE_LIMIT -> Duration.ofSeconds((long) Math.pow(2, attempt + 2));  // 4s, 8s, 16s
            case SERVER_ERROR -> Duration.ofMillis(500L * (long) Math.pow(2, attempt));
            default -> Duration.ofMillis(200L * (long) Math.pow(2, attempt));
        };
    }

    private List<GeneratedKnowledgePoint> parseKnowledgePoints(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode array = root.path("knowledgePoints");
            List<GeneratedKnowledgePoint> points = new ArrayList<>();
            if (array.isArray()) {
                for (JsonNode node : array) {
                    points.add(new GeneratedKnowledgePoint(
                            text(node, "id", "sourceKey"),
                            text(node, "statement"),
                            text(node, "type", "knowledgeType"),
                            text(node, "importance"),
                            text(node, "sourceExcerpt", "source_excerpt"),
                            !node.has("generationEligible") || node.path("generationEligible").asBoolean(),
                            toJson(node)
                    ));
                }
            }
            return points;
        } catch (Exception ex) {
            throw new IllegalStateException("DeepSeek trả về knowledge point JSON không hợp lệ", ex);
        }
    }

    private List<GeneratedQuestion> parseQuestions(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode array = root.path("questions");
            List<GeneratedQuestion> questions = new ArrayList<>();
            if (array.isArray()) {
                for (JsonNode node : array) {
                    String stem = text(node, "stem");
                    if (isGenericDocumentReferenceStem(stem)) {
                        continue;
                    }
                    questions.add(new GeneratedQuestion(
                            stem,
                            text(node, "optionA", "option_a"),
                            text(node, "optionB", "option_b"),
                            text(node, "optionC", "option_c"),
                            text(node, "optionD", "option_d"),
                            text(node, "correctAnswer", "correct_answer"),
                            text(node, "explanation"),
                            text(node, "difficulty"),
                            text(node, "topic"),
                            text(node, "sourceExcerpt", "source_excerpt"),
                            text(node, "knowledgePointId", "knowledge_point_id"),
                            toJson(node),
                            null
                    ));
                }
            }
            return questions;
        } catch (Exception ex) {
            throw new IllegalStateException("DeepSeek trả về câu hỏi JSON không hợp lệ", ex);
        }
    }

    private GeneratedQuestion withValidation(GeneratedQuestion question, String validationJson) {
        return new GeneratedQuestion(
                question.stem(),
                question.optionA(),
                question.optionB(),
                question.optionC(),
                question.optionD(),
                question.correctAnswer(),
                question.explanation(),
                question.difficulty(),
                question.topic(),
                question.sourceExcerpt(),
                question.knowledgePointId(),
                question.rawJson(),
                validationJson
        );
    }

    private String sanitizeJson(String content) {
        if (content == null) {
            return "{}";
        }
        String value = content.trim();
        if (value.startsWith("```")) {
            value = value.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        return value.trim();
    }

    private boolean isGenericDocumentReferenceStem(String stem) {
        if (stem == null || stem.isBlank()) {
            return true;
        }
        String normalized = stem.trim().toLowerCase(java.util.Locale.ROOT)
                .replaceAll("\\s+", " ");
        return normalized.startsWith("theo tài liệu")
                || normalized.startsWith("theo tai lieu")
                || normalized.startsWith("dựa vào tài liệu")
                || normalized.startsWith("dua vao tai lieu")
                || normalized.startsWith("trong tài liệu")
                || normalized.startsWith("trong tai lieu")
                || normalized.startsWith("theo nội dung")
                || normalized.startsWith("theo noi dung")
                || normalized.contains("phù hợp nhất với nội dung trong mục")
                || normalized.contains("phu hop nhat voi noi dung trong muc")
                || normalized.contains("phù hợp với nội dung trong mục")
                || normalized.contains("phu hop voi noi dung trong muc");
    }

    private String text(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode value = node.path(field);
            if (!value.isMissingNode() && !value.asText("").isBlank()) {
                return value.asText();
            }
        }
        return "";
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "{}";
        }
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    private void requireApiKey() {
        if (properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            throw new IllegalStateException("Thiếu GENERATION_API_KEY hoặc DEEPSEEK_API_KEY");
        }
    }

    private record DeepSeekCall(String content, LlmUsage usage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record DeepSeekResponse(List<Choice> choices, Usage usage) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Choice(Message message) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Message(String content) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record Usage(
            @JsonProperty("prompt_tokens") Integer promptTokens,
            @JsonProperty("completion_tokens") Integer completionTokens,
            @JsonProperty("total_tokens") Integer totalTokens
    ) {
    }
}
