package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
import java.util.concurrent.atomic.AtomicInteger;

@Component
@RequiredArgsConstructor
@Slf4j
public class DeepSeekDocumentQuestionGenerator implements DocumentQuestionGenerator {
    private static final String PIPELINE_SINGLE_CALL = "single_call";
    private static final String PIPELINE_MULTI_STAGE = "multi_stage";

    private final AiGenerationProperties properties;
    private final ObjectMapper objectMapper;
    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    private volatile Instant circuitOpenUntil = Instant.EPOCH;
    private volatile Semaphore callSemaphore;
    private volatile int callSemaphorePermits;

    @Override
    public String provider() {
        return "api";
    }

    @Override
    public GeneratedChunkResult generate(GenerationInput input) {
        requireApiKey();
        RestClient client = RestClient.builder()
                .baseUrl(properties.getApiBaseUrl())
                .build();

        if (PIPELINE_SINGLE_CALL.equalsIgnoreCase(properties.getPipelineMode())) {
            return generateSingleCall(client, input);
        }
        return generateMultiStage(client, input);
    }

    private GeneratedChunkResult generateSingleCall(RestClient client, GenerationInput input) {
        DeepSeekCall call = callDeepSeek("single_call", client, singleCallMessages(input));
        return parseSingleCallResult(call.content(), call.usage());
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

    private GeneratedChunkResult generateMultiStage(RestClient client, GenerationInput input) {
        if (!PIPELINE_MULTI_STAGE.equalsIgnoreCase(properties.getPipelineMode())) {
            log.warn("Unknown DeepSeek pipelineMode={}, falling back to multi_stage", properties.getPipelineMode());
        }

        DeepSeekCall knowledgeCall = callDeepSeek("knowledge", client, knowledgeMessages(input));
        List<GeneratedKnowledgePoint> knowledgePoints = parseKnowledgePoints(knowledgeCall.content());
        if (knowledgePoints.stream().noneMatch(GeneratedKnowledgePoint::generationEligible)) {
            return new GeneratedChunkResult(
                    provider(),
                    properties.getModel(),
                    properties.getPromptVersion(),
                    knowledgeCall.usage(),
                    knowledgePoints,
                    List.of()
            );
        }

        DeepSeekCall questionCall = callDeepSeek("questions", client, questionMessages(input, knowledgePoints));
        List<GeneratedQuestion> questions = parseQuestions(questionCall.content());
        LlmUsage usage = knowledgeCall.usage().plus(questionCall.usage());

        if (properties.isLlmValidationEnabled()) {
            List<GeneratedQuestion> validated = new ArrayList<>();
            for (GeneratedQuestion question : questions) {
                DeepSeekCall validationCall = callDeepSeek("validation", client, validationMessages(input, question));
                usage = usage.plus(validationCall.usage());
                validated.add(withValidation(question, validationCall.content()));
            }
            questions = validated;
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

    private DeepSeekCall callDeepSeek(String stage, RestClient client, List<Map<String, String>> messages) {
        checkCircuitBreaker();
        Semaphore semaphore = callSemaphore();
        acquirePermit(semaphore, stage);
        RuntimeException lastError = null;
        try {
            for (int attempt = 0; attempt <= properties.getMaxRetries(); attempt++) {
                Instant started = Instant.now();
                try {
                    DeepSeekResponse response = client.post()
                            .uri("/chat/completions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.getApiKey())
                            .body(Map.of(
                                    "model", properties.getModel(),
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
                    consecutiveFailures.set(0);
                    log.info(
                            "DeepSeek call completed stage={} attempt={} latencyMs={} promptTokens={} completionTokens={} totalTokens={}",
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
                    log.warn(
                            "DeepSeek call failed stage={} attempt={} latencyMs={} message={}",
                            stage,
                            attempt + 1,
                            latencyMs,
                            ex.getMessage()
                    );
                    lastError = ex;
                }
            }
            recordFailure();
            throw lastError == null ? new IllegalStateException("Không gọi được DeepSeek") : lastError;
        } finally {
            semaphore.release();
        }
    }

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

    private void acquirePermit(Semaphore semaphore, String stage) {
        try {
            semaphore.acquire();
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Bị ngắt khi chờ giới hạn gọi DeepSeek stage=" + stage, ex);
        }
    }

    private void checkCircuitBreaker() {
        if (Instant.now().isBefore(circuitOpenUntil)) {
            throw new IllegalStateException("DeepSeek circuit breaker đang mở đến " + circuitOpenUntil);
        }
    }

    private void recordFailure() {
        int failures = consecutiveFailures.incrementAndGet();
        if (failures >= Math.max(1, properties.getCircuitBreakerFailureThreshold())) {
            circuitOpenUntil = Instant.now().plusSeconds(Math.max(1, properties.getCircuitBreakerCooldownSeconds()));
            consecutiveFailures.set(0);
            log.warn("DeepSeek circuit breaker opened until={}", circuitOpenUntil);
        }
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
