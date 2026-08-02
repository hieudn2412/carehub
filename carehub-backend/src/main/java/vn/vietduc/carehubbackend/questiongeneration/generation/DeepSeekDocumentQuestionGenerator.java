package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

import java.net.http.HttpClient;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

@Component
@Slf4j
public class DeepSeekDocumentQuestionGenerator implements DocumentQuestionGenerator {
    private static final String PIPELINE_SINGLE_CALL = "single_call";
    private static final String PIPELINE_MULTI_STAGE = "multi_stage";

    private final AiGenerationProperties properties;
    private final ObjectMapper objectMapper;
    private final GroundedV4PromptCatalog promptCatalog;
    private final MeterRegistry meterRegistry;
    /* package */ final AtomicReference<CircuitState> circuitState = new AtomicReference<>(CircuitState.CLOSED);
    private final AtomicInteger failureCount = new AtomicInteger();
    private final AtomicInteger halfOpenProbeCount = new AtomicInteger();
    private volatile Instant stateChangedAt = Instant.now();
    private volatile Semaphore callSemaphore;
    private volatile int callSemaphorePermits;
    private volatile RestClient restClient;

    /* package */ enum CircuitState { CLOSED, OPEN, HALF_OPEN }

    /* package */ enum DeepSeekErrorType {
        AUTHENTICATION, RATE_LIMIT, SERVER_ERROR, TIMEOUT, PARSE_ERROR, UNKNOWN
    }

    @Autowired
    public DeepSeekDocumentQuestionGenerator(
            AiGenerationProperties properties,
            ObjectMapper objectMapper,
            GroundedV4PromptCatalog promptCatalog,
            MeterRegistry meterRegistry
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.promptCatalog = promptCatalog;
        this.meterRegistry = meterRegistry;
    }

    public DeepSeekDocumentQuestionGenerator(
            AiGenerationProperties properties,
            ObjectMapper objectMapper,
            GroundedV4PromptCatalog promptCatalog
    ) {
        this(properties, objectMapper, promptCatalog, null);
    }

    public DeepSeekDocumentQuestionGenerator(AiGenerationProperties properties, ObjectMapper objectMapper) {
        this(properties, objectMapper, new GroundedV4PromptCatalog(), null);
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
        // HttpClient của JDK giữ kết nối (keep-alive) giữa các lời gọi, khác với
        // SimpleClientHttpRequestFactory vốn bắt tay TCP+TLS lại từ đầu mỗi lần.
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(properties.getConnectTimeoutSeconds()))
                .executor(Executors.newFixedThreadPool(
                        Math.max(1, properties.getMaxConnections()),
                        runnable -> {
                            Thread thread = new Thread(runnable, "deepseek-http");
                            thread.setDaemon(true);
                            return thread;
                        }))
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
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
            return generateWithModel(client, input, properties.getModel());
        } catch (RuntimeException ex) {
            String fallbackModel = properties.getFallbackModel();
            if (fallbackModel == null || fallbackModel.isBlank()
                    || fallbackModel.equals(properties.getModel())) {
                throw ex;
            }
            log.warn("Primary model {} failed, trying fallback model {}: {}",
                    properties.getModel(), fallbackModel, ex.getMessage());
            try {
                return generateWithModel(client, input, fallbackModel);
            } catch (RuntimeException fallbackEx) {
                throw new IllegalStateException(
                        "Cả primary model " + properties.getModel()
                                + " và fallback model " + fallbackModel + " đều thất bại", fallbackEx);
            }
        }
    }

    private GeneratedChunkResult generateWithModel(RestClient client, GenerationInput input, String model) {
        if ("GROUNDED_V4".equalsIgnoreCase(input.pipelineVersion())) {
            return generateGroundedV4WithModel(client, input, model);
        }
        if (PIPELINE_SINGLE_CALL.equalsIgnoreCase(properties.getPipelineMode())) {
            return generateSingleCallWithModel(client, input, model);
        }
        return generateMultiStageWithModel(client, input, model);
    }

    private GeneratedChunkResult generateSingleCallWithModel(RestClient client, GenerationInput input, String model) {
        DeepSeekCall call = callDeepSeek(
                "single_call",
                client,
                singleCallMessages(input),
                model,
                properties.getTemperature(),
                properties.getMaxOutputTokens()
        );
        return parseSingleCallResult(call.content(), call.usage(), model);
    }

    private GeneratedChunkResult generateMultiStageWithModel(RestClient client, GenerationInput input, String model) {
        DeepSeekCall knowledgeCall = callDeepSeek(
                "knowledge",
                client,
                knowledgeMessages(input),
                model,
                properties.getTemperature(),
                properties.getMaxOutputTokens()
        );
        List<GeneratedKnowledgePoint> knowledgePoints = parseKnowledgePoints(knowledgeCall.content());
        // Ở đây danh sách rỗng dừng sớm là ĐÚNG: chưa gọi lượt sinh câu hỏi nào nên không mất gì,
        // và không có knowledge point thì lượt sau cũng không có gì để bám vào.
        // (Khác hẳn parseSingleCallResult — chỗ đó câu hỏi đã sinh và đã tính tiền rồi.)
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

        DeepSeekCall questionCall = callDeepSeek(
                "questions",
                client,
                questionMessages(input, knowledgePoints),
                model,
                properties.getTemperature(),
                properties.getMaxOutputTokens()
        );
        List<GeneratedQuestion> questions = parseQuestions(questionCall.content());
        LlmUsage usage = knowledgeCall.usage().plus(questionCall.usage());

        if (properties.isLlmValidationEnabled()) {
            List<GeneratedQuestion> validated = new ArrayList<>();
            for (GeneratedQuestion question : questions) {
                DeepSeekCall validationCall = callDeepSeek(
                        "validation",
                        client,
                        validationMessages(input, question),
                        model,
                        properties.getTemperature(),
                        properties.getMaxOutputTokens()
                );
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

    private GeneratedChunkResult generateGroundedV4WithModel(
            RestClient client,
            GenerationInput input,
            String model
    ) {
        ParsedStage<List<GeneratedKnowledgePoint>> knowledgeStage = callJsonStage(
                "v4_knowledge",
                client,
                groundedKnowledgeMessages(input),
                model,
                properties.getKnowledgeTemperature(),
                properties.getKnowledgeMaxOutputTokens(),
                promptCatalog.knowledgePrompt(),
                this::parseKnowledgePointsStrict
        );
        List<GeneratedKnowledgePoint> groundedPoints = knowledgeStage.value().stream()
                .filter(GeneratedKnowledgePoint::generationEligible)
                .filter(point -> !isBlank(point.statement()))
                .filter(point -> containsExactExcerpt(input.chunkText(), point.sourceExcerpt()))
                .toList();
        if (groundedPoints.isEmpty()) {
            return new GeneratedChunkResult(
                    provider(),
                    model,
                    promptCatalog.versionWithHash(),
                    knowledgeStage.usage(),
                    List.of(),
                    List.of(),
                    0,
                    knowledgeStage.repairCallCount()
            );
        }

        ParsedStage<List<GeneratedQuestion>> questionStage = callJsonStage(
                "v4_questions",
                client,
                groundedQuestionMessages(input, groundedPoints),
                model,
                properties.getQuestionTemperature(),
                properties.getQuestionMaxOutputTokens(),
                promptCatalog.questionPrompt(),
                this::parseQuestionsStrict
        );
        LlmUsage usage = knowledgeStage.usage().plus(questionStage.usage());
        int repairCalls = knowledgeStage.repairCallCount() + questionStage.repairCallCount();
        int criticCalls = 0;
        List<GeneratedQuestion> questions = new ArrayList<>();

        for (GeneratedQuestion question : questionStage.value().stream()
                .limit(Math.max(0, input.questionsPerChunk()))
                .toList()) {
            if (!shouldRunCritic(input, question, groundedPoints)) {
                questions.add(question);
                continue;
            }
            ParsedStage<String> criticStage = callJsonStage(
                    "v4_critic",
                    client,
                    groundedCriticMessages(input, question),
                    model,
                    properties.getCriticTemperature(),
                    properties.getCriticMaxOutputTokens(),
                    promptCatalog.criticPrompt(),
                    this::validateCriticJson
            );
            usage = usage.plus(criticStage.usage());
            repairCalls += criticStage.repairCallCount();
            criticCalls++;
            questions.add(withValidation(question, criticStage.value()));
        }

        return new GeneratedChunkResult(
                provider(),
                model,
                promptCatalog.versionWithHash(),
                usage,
                groundedPoints,
                questions,
                criticCalls,
                repairCalls
        );
    }

    private <T> ParsedStage<T> callJsonStage(
            String stage,
            RestClient client,
            List<Map<String, String>> messages,
            String model,
            double temperature,
            int maxOutputTokens,
            String schemaPrompt,
            Function<String, T> parser
    ) {
        DeepSeekCall initial = callDeepSeek(
                stage,
                client,
                messages,
                model,
                temperature,
                maxOutputTokens
        );
        try {
            return new ParsedStage<>(parser.apply(initial.content()), initial.usage(), 0);
        } catch (RuntimeException parseError) {
            log.warn("Grounded v4 schema validation failed stage={}, attempting one repair: {}",
                    stage, parseError.getMessage());
            DeepSeekCall repair = callDeepSeek(
                    stage + "_repair",
                    client,
                    repairMessages(schemaPrompt, initial.content()),
                    model,
                    0.0,
                    maxOutputTokens
            );
            try {
                return new ParsedStage<>(
                        parser.apply(repair.content()),
                        initial.usage().plus(repair.usage()),
                        1
                );
            } catch (RuntimeException repairError) {
                throw new IllegalStateException(
                        "INVALID_MODEL_OUTPUT: JSON không đúng schema sau một lần repair, stage=" + stage,
                        repairError
                );
            }
        }
    }

    private List<Map<String, String>> groundedKnowledgeMessages(GenerationInput input) {
        return List.of(
                Map.of("role", "system", "content", promptCatalog.knowledgePrompt()),
                Map.of(
                        "role",
                        "user",
                        "content",
                        """
                                Tài liệu: %s
                                Section: %s
                                Trang: %s-%s

                                Chunk:
                                %s

                                Trích xuất tối đa 8 knowledge point theo schema bắt buộc.
                                """.formatted(
                                nullToFallback(input.documentName(), "Không rõ"),
                                nullToFallback(input.sectionPath(), "Không rõ"),
                                input.pageStart() == null ? "?" : input.pageStart(),
                                input.pageEnd() == null ? "?" : input.pageEnd(),
                                input.chunkText()
                        )
                )
        );
    }

    private List<Map<String, String>> groundedQuestionMessages(
            GenerationInput input,
            List<GeneratedKnowledgePoint> knowledgePoints
    ) {
        return List.of(
                Map.of("role", "system", "content", promptCatalog.questionPrompt()),
                Map.of(
                        "role",
                        "user",
                        "content",
                        """
                                Tài liệu: %s
                                Section: %s
                                Trang: %s-%s
                                Danh mục: %s
                                Mô tả danh mục: %s
                                Độ khó mục tiêu: %s

                                Chunk:
                                %s

                                Knowledge points đã kiểm tra grounding:
                                %s

                                Tạo tối đa %d câu hỏi. questionsPerChunk là giới hạn trên, không phải số lượng bắt buộc.
                                """.formatted(
                                nullToFallback(input.documentName(), "Không rõ"),
                                nullToFallback(input.sectionPath(), "Không rõ"),
                                input.pageStart() == null ? "?" : input.pageStart(),
                                input.pageEnd() == null ? "?" : input.pageEnd(),
                                nullToFallback(input.categoryName(), "Tự động theo nguồn"),
                                nullToFallback(input.categoryDescription(), "Không có"),
                                nullToFallback(input.targetDifficulty(), "AUTO"),
                                input.chunkText(),
                                toJson(knowledgePoints),
                                input.questionsPerChunk()
                        )
                )
        );
    }

    private List<Map<String, String>> groundedCriticMessages(
            GenerationInput input,
            GeneratedQuestion question
    ) {
        return List.of(
                Map.of("role", "system", "content", promptCatalog.criticPrompt()),
                Map.of(
                        "role",
                        "user",
                        "content",
                        """
                                Chunk nguồn:
                                %s

                                Candidate:
                                %s
                                """.formatted(input.chunkText(), toJson(question))
                )
        );
    }

    private List<Map<String, String>> repairMessages(String schemaPrompt, String invalidJson) {
        return List.of(
                Map.of(
                        "role",
                        "system",
                        "content",
                        """
                                Sửa JSON để đúng schema bên dưới. Không thêm hoặc thay đổi dữ kiện.
                                Nếu dữ liệu không đủ, dùng mảng rỗng theo schema.
                                Chỉ trả JSON object hợp lệ.

                                %s
                                """.formatted(schemaPrompt)
                ),
                Map.of("role", "user", "content", invalidJson == null ? "{}" : invalidJson)
        );
    }

    List<GeneratedKnowledgePoint> parseKnowledgePointsStrict(String json) {
        JsonNode root = readObject(json, "knowledgePoints");
        JsonNode array = root.path("knowledgePoints");
        if (!array.isArray()) {
            throw new IllegalStateException("JSON thiếu mảng knowledgePoints");
        }
        List<GeneratedKnowledgePoint> points = parseKnowledgePoints(json);
        for (GeneratedKnowledgePoint point : points) {
            if (isBlank(point.id()) || isBlank(point.statement()) || isBlank(point.sourceExcerpt())) {
                throw new IllegalStateException("Knowledge point thiếu id, statement hoặc sourceExcerpt");
            }
        }
        return points;
    }

    List<GeneratedQuestion> parseQuestionsStrict(String json) {
        JsonNode root = readObject(json, "questions");
        JsonNode array = root.path("questions");
        if (!array.isArray()) {
            throw new IllegalStateException("JSON thiếu mảng questions");
        }
        for (JsonNode node : array) {
            requireText(node, "questionType");
            requireText(node, "stem");
            requireText(node, "optionA");
            requireText(node, "optionB");
            requireText(node, "optionC");
            requireText(node, "optionD");
            requireText(node, "correctAnswer");
            requireText(node, "explanation");
            requireText(node, "difficulty");
            requireText(node, "sourceExcerpt");
            requireText(node, "answerEvidence");
            requireText(node, "knowledgePointId");
            if (!Set.of("recall", "application", "procedure", "warning", "comparison")
                    .contains(node.path("questionType").asText().toLowerCase(java.util.Locale.ROOT))) {
                throw new IllegalStateException("Question có questionType không hợp lệ");
            }
            if (!Set.of("easy", "medium", "hard")
                    .contains(node.path("difficulty").asText().toLowerCase(java.util.Locale.ROOT))) {
                throw new IllegalStateException("Question có difficulty không hợp lệ");
            }
            if (!node.path("correctAnswer").asText().matches("[ABCD]")) {
                throw new IllegalStateException("Question có correctAnswer không hợp lệ");
            }
            JsonNode rationales = node.path("distractorRationales");
            if (!rationales.isObject()) {
                throw new IllegalStateException("Question thiếu distractorRationales object");
            }
            String correctAnswer = node.path("correctAnswer").asText();
            for (String option : List.of("A", "B", "C", "D")) {
                if (!option.equals(correctAnswer)
                        && (!rationales.has(option) || rationales.path(option).asText("").isBlank())) {
                    throw new IllegalStateException("Question thiếu rationale cho distractor " + option);
                }
            }
        }
        return parseQuestions(json);
    }

    String validateCriticJson(String json) {
        JsonNode root = readObject(json, "critic");
        for (String field : List.of(
                "answerable",
                "singleBestAnswer",
                "correctAnswerSupported",
                "distractorsInvalid",
                "surfaceCueFree",
                "distractorsPlausible",
                "requiresDomainReasoning"
        )) {
            if (!root.has(field) || !root.path(field).isBoolean()) {
                throw new IllegalStateException("Critic thiếu boolean " + field);
            }
        }
        if (!root.has("qualityScore") || !root.path("qualityScore").isNumber()) {
            throw new IllegalStateException("Critic thiếu qualityScore");
        }
        if (!root.path("issues").isArray()) {
            throw new IllegalStateException("Critic thiếu issues array");
        }
        return sanitizeJson(json);
    }

    private JsonNode readObject(String json, String stage) {
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root == null || !root.isObject()) {
                throw new IllegalStateException("JSON stage " + stage + " không phải object");
            }
            return root;
        } catch (Exception ex) {
            throw new IllegalStateException("JSON stage " + stage + " không hợp lệ", ex);
        }
    }

    private void requireText(JsonNode node, String field) {
        if (!node.has(field) || !node.path(field).isTextual() || node.path(field).asText().isBlank()) {
            throw new IllegalStateException("Question thiếu field " + field);
        }
    }

    boolean shouldRunCritic(
            GenerationInput input,
            GeneratedQuestion question,
            List<GeneratedKnowledgePoint> knowledgePoints
    ) {
        boolean mappedKnowledgePoint = knowledgePoints.stream()
                .anyMatch(point -> point.id().equals(question.knowledgePointId()));
        if (!mappedKnowledgePoint
                || !containsExactExcerpt(input.chunkText(), question.sourceExcerpt())
                || !containsExactExcerpt(input.chunkText(), question.answerEvidence())) {
            return false;
        }
        String normalized = normalizeForRisk(question.stem() + " "
                + question.optionA() + " " + question.optionB() + " "
                + question.optionC() + " " + question.optionD());
        return isBlank(question.distractorRationales())
                || Set.of("medium", "hard").contains(
                        nullToFallback(question.difficulty(), "").toLowerCase(java.util.Locale.ROOT))
                || hasObviousSurfaceCue(question)
                || normalized.matches(".*\\b(khong|sai|ngoai tru)\\b.*")
                || normalized.matches(".*\\b(benh nhan|nguoi benh|lam sang|chan doan|xu tri)\\b.*")
                || normalized.matches(".*\\b(thuoc|lieu|mg|ml|truyen|tiem|thu thuat|phau thuat)\\b.*")
                || normalized.matches(".*\\b(truoc|sau|buoc|quy trinh|trinh tu)\\b.*");
    }

    private boolean hasObviousSurfaceCue(GeneratedQuestion question) {
        List<String> options = List.of(
                nullToFallback(question.optionA(), ""),
                nullToFallback(question.optionB(), ""),
                nullToFallback(question.optionC(), ""),
                nullToFallback(question.optionD(), "")
        );
        String correct = switch (nullToFallback(question.correctAnswer(), "")) {
            case "A" -> options.get(0);
            case "B" -> options.get(1);
            case "C" -> options.get(2);
            case "D" -> options.get(3);
            default -> "";
        };
        double distractorAverage = options.stream()
                .filter(option -> !option.equals(correct))
                .mapToInt(this::wordCount)
                .average()
                .orElse(0);
        boolean correctLengthCue = wordCount(correct) >= distractorAverage * 1.65
                && wordCount(correct) - distractorAverage >= 4;
        return correctLengthCue || options.stream().anyMatch(this::containsAbsoluteCue);
    }

    private int wordCount(String value) {
        String normalized = normalizeWhitespace(value);
        return normalized.isBlank() ? 0 : normalized.split("\\s+").length;
    }

    private boolean containsAbsoluteCue(String value) {
        String normalized = normalizeForRisk(value);
        return normalized.matches(".*\\b(luon luon|khong bao gio|hoan toan|chi can|duy nhat)\\b.*");
    }

    private boolean containsExactExcerpt(String source, String excerpt) {
        if (isBlank(source) || isBlank(excerpt)) {
            return false;
        }
        return source.contains(excerpt.trim());
    }

    private String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("\\s+", " ").trim();
    }

    private String normalizeForRisk(String value) {
        return java.text.Normalizer.normalize(value == null ? "" : value, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(java.util.Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String nullToFallback(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    GeneratedChunkResult parseSingleCallResult(String json, LlmUsage usage) {
        return parseSingleCallResult(json, usage, properties.getModel());
    }

    GeneratedChunkResult parseSingleCallResult(String json, LlmUsage usage, String model) {
        List<GeneratedKnowledgePoint> knowledgePoints = parseKnowledgePoints(json);
        List<GeneratedQuestion> questions = parseQuestions(json);
        int parsedQuestionCount = questions.size();
        // Chỉ áp cổng lọc khi model THỰC SỰ có trả knowledge point và đánh dấu tất cả là không
        // dùng được. `noneMatch` trên danh sách RỖNG trả true (chân lý rỗng) — mà prompt lại cho
        // phép trả 0 knowledge point, nên nếu không chặn thì mọi câu hỏi hợp lệ kèm
        // `knowledgePoints: []` đều bị vứt sau khi đã gọi API và đã tính tiền token.
        if (!knowledgePoints.isEmpty()
                && knowledgePoints.stream().noneMatch(GeneratedKnowledgePoint::generationEligible)) {
            log.info(
                    "Silent drop: all knowledge points ineligible. totalKPs={} eligibleKPs=0 parsedQuestions={}",
                    knowledgePoints.size(), parsedQuestionCount
            );
            questions = List.of();
        }
        log.info("parseSingleCallResult: kpCount={} questionCount={} rawJsonLen={}",
                knowledgePoints.size(), questions.size(), json != null ? json.length() : 0);
        return new GeneratedChunkResult(
                provider(),
                model,
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
                                Bạn là bác sĩ lâm sàng, chuyên tạo câu hỏi trắc nghiệm 1 đáp án cho đào tạo bệnh viện Việt Nam.

                                QUY TẮC:
                                - Chỉ dùng thông tin trong chunk, không suy diễn ngoài.
                                - Viết tiếng Việt tự nhiên, giữ thuật ngữ chuyên môn tiếng Anh khi cần.
                                - Stem tự đứng độc lập, không mở đầu bằng "Theo tài liệu", "Dựa vào tài liệu", "Trong tài liệu".
                                - Không dùng "tất cả đều đúng", "cả A và B", "không có đáp án nào".
                                - Mỗi câu có đúng 1 đáp án tốt nhất.
                                - Nếu chunk không đủ thông tin độc lập → questions là mảng rỗng [].
                                - sourceExcerpt phải là đoạn TRÍCH NGUYÊN VĂN, copy y hệt từ chunk, không diễn đạt lại.
                                - generationEligible chỉ đặt false khi knowledge point đó KHÔNG đủ để ra một câu hỏi
                                  tự đứng độc lập (ví dụ chỉ là tiêu đề, mục lục, hoặc câu dẫn không mang nội dung).
                                  Knowledge point dùng được thì luôn để true.

                                ĐA DẠNG CÂU HỎI — xoay vòng các kiểu sau, tránh lặp:
                                1. Tình huống lâm sàng (bệnh nhân + triệu chứng → chẩn đoán/xử trí)
                                2. Chỉ định/chống chỉ định thuốc hoặc thủ thuật
                                3. Cơ chế bệnh sinh/tác dụng thuốc
                                4. Phân biệt chẩn đoán giữa các bệnh
                                5. Xét nghiệm cận lâm sàng phù hợp
                                6. Biến chứng/tiên lượng

                                VÍ DỤ NGẮN:
                                {"knowledgePoints":[{"id":"KP1","statement":"Triệu chứng chính của sốt xuất huyết Dengue","type":"fact","importance":"high","sourceExcerpt":"Sốt cao đột ngột, đau đầu, đau cơ, phát ban","generationEligible":true}],"questions":[{"stem":"Bệnh nhân 8 tuổi sốt cao liên tục 3 ngày, đau đầu nhiều, đau mỏi cơ toàn thân, xét nghiệm NS1 dương tính. Triệu chứng nào KHÔNG điển hình của sốt xuất huyết Dengue?","optionA":"Sốt cao đột ngột","optionB":"Đau đầu","optionC":"Ho khạc đờm vàng","optionD":"Đau cơ","correctAnswer":"C","explanation":"Ho khạc đờm vàng là triệu chứng viêm phổi/nhiễm khuẩn hô hấp, không phải triệu chứng điển hình của SXH Dengue.","difficulty":"medium","topic":"Sốt xuất huyết","sourceExcerpt":"Sốt cao đột ngột, đau đầu, đau cơ, phát ban","knowledgePointId":"KP1"}]}

                                OUTPUT: Chỉ trả về JSON hợp lệ, không bọc markdown, không giải thích ngoài JSON.
                                """
                ),
                Map.of(
                        "role", "user",
                        "content", """
                                Section path: %s

                                Chunk:
                                %s

                                Trích xuất 0-8 knowledge point và tạo tối đa %d câu hỏi single-choice.
                                Mỗi câu hỏi phong cách khác nhau.
                                Trả JSON:
                                {
                                  "knowledgePoints": [{"id":"KP1","statement":"...","type":"definition|fact|procedure|warning|principle","importance":"low|medium|high","sourceExcerpt":"trích dẫn nguyên văn ngắn từ chunk","generationEligible":true}],
                                  "questions": [{"stem":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"A","explanation":"...","difficulty":"easy|medium|hard","topic":"...","sourceExcerpt":"trích dẫn nguyên văn ngắn từ chunk","knowledgePointId":"KP1"}]
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

    private DeepSeekCall callDeepSeek(
            String stage,
            RestClient client,
            List<Map<String, String>> messages,
            String model,
            double temperature,
            int maxOutputTokens
    ) {
        checkCircuitBreaker();
        Semaphore semaphore = callSemaphore();
        acquirePermit(semaphore, stage);
        boolean holdsPermit = true;
        DeepSeekErrorType lastErrorType = DeepSeekErrorType.UNKNOWN;
        RuntimeException lastError = null;
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
                                    "temperature", temperature,
                                    "top_p", properties.getTopP(),
                                    "max_tokens", maxOutputTokens,
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
                    recordCallMetrics(model, stage, "success", latencyMs, usage);
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
                    lastErrorType = classifyError(ex);
                    recordCallMetrics(model, stage, lastErrorType.name().toLowerCase(), latencyMs, null);
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
                    // Backoff: nhả permit trong lúc chờ để không khoá slot của các chunk khác,
                    // rồi acquire lại trước khi thử lần kế tiếp.
                    Duration backoff = retryBackoffFor(lastErrorType, attempt);
                    semaphore.release();
                    holdsPermit = false;
                    try {
                        Thread.sleep(backoff.toMillis());
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                    acquirePermit(semaphore, stage);
                    holdsPermit = true;
                }
            }
            recordFailure(lastErrorType);
            throw lastError == null ? new IllegalStateException("Không gọi được DeepSeek") : lastError;
        } finally {
            if (holdsPermit) {
                semaphore.release();
            }
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

    // ── Circuit Breaker (AtomicReference + CAS) ──

    private static final int HALF_OPEN_MAX_PROBES = 2;

    private void checkCircuitBreaker() {
        CircuitState state = circuitState.get();
        Instant now = Instant.now();

        if (state == CircuitState.CLOSED) {
            return;
        }

        if (state == CircuitState.OPEN) {
            long cooldownSeconds = Math.max(1, properties.getCircuitBreakerCooldownSeconds());
            if (now.isAfter(stateChangedAt.plusSeconds(cooldownSeconds))) {
                // CAS từ OPEN → HALF_OPEN: chỉ 1 thread thắng
                if (circuitState.compareAndSet(CircuitState.OPEN, CircuitState.HALF_OPEN)) {
                    halfOpenProbeCount.set(0);
                    stateChangedAt = now;
                    log.info("DeepSeek circuit breaker: OPEN → HALF_OPEN");
                    return;
                }
                // Thread khác đã transition rồi — đọc lại state
                state = circuitState.get();
                if (state == CircuitState.CLOSED) return;
                if (state == CircuitState.HALF_OPEN) {
                    if (halfOpenProbeCount.incrementAndGet() <= HALF_OPEN_MAX_PROBES) {
                        return;
                    }
                    throw new IllegalStateException(
                            "DeepSeek circuit breaker HALF_OPEN, đã đạt max probes=" + HALF_OPEN_MAX_PROBES);
                }
            }
            throw new IllegalStateException(
                    "DeepSeek circuit breaker OPEN đến "
                            + stateChangedAt.plusSeconds(cooldownSeconds));
        }

        // HALF_OPEN
        if (halfOpenProbeCount.incrementAndGet() <= HALF_OPEN_MAX_PROBES) {
            return;
        }
        throw new IllegalStateException(
                "DeepSeek circuit breaker HALF_OPEN, đã đạt max probes=" + HALF_OPEN_MAX_PROBES);
    }

    private void recordSuccess() {
        circuitState.updateAndGet(state -> {
            if (state == CircuitState.HALF_OPEN) {
                stateChangedAt = Instant.now();
                log.info("DeepSeek circuit breaker: HALF_OPEN → CLOSED (probe succeeded)");
                return CircuitState.CLOSED;
            }
            if (state == CircuitState.CLOSED) {
                failureCount.set(0);
            }
            return state; // OPEN: không thay đổi
        });
    }

    private void recordFailure(DeepSeekErrorType errorType) {
        if (errorType == DeepSeekErrorType.AUTHENTICATION) {
            log.error("DeepSeek authentication error — check API key");
            return;
        }
        if (errorType == DeepSeekErrorType.RATE_LIMIT) {
            log.warn("DeepSeek rate limited, backing off");
        }

        circuitState.updateAndGet(state -> {
            if (state == CircuitState.HALF_OPEN) {
                stateChangedAt = Instant.now();
                log.warn("DeepSeek circuit breaker: HALF_OPEN → OPEN (probe failed)");
                return CircuitState.OPEN;
            }
            if (state == CircuitState.CLOSED) {
                int failures = failureCount.incrementAndGet();
                if (failures >= Math.max(1, properties.getCircuitBreakerFailureThreshold())) {
                    stateChangedAt = Instant.now();
                    log.warn("DeepSeek circuit breaker: CLOSED → OPEN ({} consecutive failures)", failures);
                    return CircuitState.OPEN;
                }
            }
            return state;
        });
    }

    // ── Error Classification ──

    /* package */ DeepSeekErrorType classifyError(Throwable ex) {
        // RestClient ném HttpClientErrorException/HttpServerErrorException — cả hai đều là
        // RestClientResponseException và mang theo HTTP status thật.
        for (Throwable current = ex; current != null; current = current.getCause()) {
            if (current instanceof RestClientResponseException http) {
                return switch (http.getStatusCode().value()) {
                    case 401, 403 -> DeepSeekErrorType.AUTHENTICATION;
                    case 429 -> DeepSeekErrorType.RATE_LIMIT;
                    case 500, 502, 503, 504 -> DeepSeekErrorType.SERVER_ERROR;
                    default -> DeepSeekErrorType.UNKNOWN;
                };
            }
            if (current instanceof java.net.SocketTimeoutException
                    || current instanceof java.net.http.HttpConnectTimeoutException
                    || current instanceof java.util.concurrent.TimeoutException) {
                return DeepSeekErrorType.TIMEOUT;
            }
            if (current instanceof IllegalStateException
                    && current.getMessage() != null
                    && current.getMessage().contains("JSON")) {
                return DeepSeekErrorType.PARSE_ERROR;
            }
        }
        return DeepSeekErrorType.UNKNOWN;
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
            int skippedByStemFilter = 0;
            if (array.isArray()) {
                for (JsonNode node : array) {
                    String stem = text(node, "stem");
                    if (isGenericDocumentReferenceStem(stem)) {
                        skippedByStemFilter++;
                        log.info("Question dropped by stem filter: stem='{}'", stem.length() > 60 ? stem.substring(0, 60) + "..." : stem);
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
                            null,
                            text(node, "questionType", "question_type"),
                            text(node, "answerEvidence", "answer_evidence"),
                            node.path("distractorRationales").isObject()
                                    ? toJson(node.path("distractorRationales"))
                                    : null
                    ));
                }
            }
            if (skippedByStemFilter > 0) {
                log.info("parseQuestions: totalInJson={} kept={} skippedByStemFilter={}",
                        array.isArray() ? array.size() : 0, questions.size(), skippedByStemFilter);
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
                validationJson,
                question.questionType(),
                question.answerEvidence(),
                question.distractorRationales()
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

    private void recordCallMetrics(
            String model,
            String stage,
            String outcome,
            long latencyMs,
            Usage usage
    ) {
        if (meterRegistry == null) {
            return;
        }
        Tags tags = Tags.of(
                "pipeline", stage.startsWith("v4_") ? "GROUNDED_V4" : "LEGACY_V3",
                "provider", provider(),
                "model", model,
                "stage", stage,
                "outcome", outcome
        );
        meterRegistry.counter("carehub.question_generation.calls", tags).increment();
        meterRegistry.timer("carehub.question_generation.latency", tags)
                .record(Duration.ofMillis(Math.max(0, latencyMs)));
        if (usage != null) {
            meterRegistry.counter("carehub.question_generation.prompt_tokens", tags)
                    .increment(valueOrZero(usage.promptTokens()));
            meterRegistry.counter("carehub.question_generation.completion_tokens", tags)
                    .increment(valueOrZero(usage.completionTokens()));
        }
    }

    private record ParsedStage<T>(T value, LlmUsage usage, int repairCallCount) {
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
