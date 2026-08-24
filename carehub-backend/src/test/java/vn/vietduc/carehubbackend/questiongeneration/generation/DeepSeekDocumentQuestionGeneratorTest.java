package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.generation.DeepSeekDocumentQuestionGenerator.DeepSeekErrorType;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

import java.net.SocketTimeoutException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import com.sun.net.httpserver.HttpServer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DeepSeekDocumentQuestionGeneratorTest {

    private final AiGenerationProperties properties = new AiGenerationProperties();
    private final DeepSeekDocumentQuestionGenerator generator = new DeepSeekDocumentQuestionGenerator(
            properties,
            new ObjectMapper()
    );

    @Test
    void parsesSingleCallKnowledgePointsAndQuestions() {
        GeneratedChunkResult result = generator.parseSingleCallResult("""
                {
                  "knowledgePoints": [
                    {
                      "id": "KP1",
                      "statement": "Người bệnh phản vệ cần được xử trí ngay.",
                      "type": "procedure",
                      "importance": "high",
                      "sourceExcerpt": "xử trí ngay",
                      "generationEligible": true
                    }
                  ],
                  "questions": [
                    {
                      "stem": "Khi người bệnh có dấu hiệu phản vệ, hành động phù hợp nhất là gì?",
                      "optionA": "Xử trí ngay theo phác đồ phản vệ.",
                      "optionB": "Chờ người bệnh tự ổn định.",
                      "optionC": "Chỉ theo dõi mạch.",
                      "optionD": "Cho người bệnh uống nước.",
                      "correctAnswer": "A",
                      "explanation": "Đáp án A bám trực tiếp vào nguồn.",
                      "difficulty": "medium",
                      "topic": "Cấp cứu phản vệ",
                      "sourceExcerpt": "xử trí ngay",
                      "knowledgePointId": "KP1"
                    }
                  ]
                }
                """, new LlmUsage(1, 100, 80, 180, 1200));

        assertThat(result.usage().callCount()).isEqualTo(1);
        assertThat(result.knowledgePoints()).hasSize(1);
        assertThat(result.knowledgePoints().get(0).generationEligible()).isTrue();
        assertThat(result.questions()).hasSize(1);
        assertThat(result.questions().get(0).correctAnswer()).isEqualTo("A");
        assertThat(result.questions().get(0).knowledgePointId()).isEqualTo("KP1");
    }

    @Test
    void dropsQuestionsWhenNoEligibleKnowledgePointExists() {
        GeneratedChunkResult result = generator.parseSingleCallResult("""
                {
                  "knowledgePoints": [
                    {
                      "id": "KP1",
                      "statement": "Đoạn này chỉ là tiêu đề.",
                      "type": "fact",
                      "importance": "low",
                      "sourceExcerpt": "tiêu đề",
                      "generationEligible": false
                    }
                  ],
                  "questions": [
                    {
                      "stem": "Câu này không nên được giữ?",
                      "optionA": "A",
                      "optionB": "B",
                      "optionC": "C",
                      "optionD": "D",
                      "correctAnswer": "A",
                      "explanation": "Không đủ nguồn.",
                      "difficulty": "easy",
                      "topic": "Demo",
                      "sourceExcerpt": "tiêu đề",
                      "knowledgePointId": "KP1"
                    }
                  ]
                }
                """, LlmUsage.empty());

        assertThat(result.knowledgePoints()).hasSize(1);
        assertThat(result.questions()).isEmpty();
    }

    @Test
    void dropsGenericDocumentReferenceQuestionStems() {
        GeneratedChunkResult result = generator.parseSingleCallResult("""
                {
                  "knowledgePoints": [
                    {
                      "id": "KP1",
                      "statement": "Xuất huyết tiêu hóa có thể gây mạch nhanh và huyết áp tụt.",
                      "type": "warning",
                      "importance": "high",
                      "sourceExcerpt": "mạch nhanh và huyết áp tụt",
                      "generationEligible": true
                    }
                  ],
                  "questions": [
                    {
                      "stem": "Theo tài liệu, nhận định nào sau đây phù hợp nhất với nội dung trong mục \\"1.2.1. Đặc điểm sinh lý\\"?",
                      "optionA": "Mạch nhanh và huyết áp tụt là dấu hiệu cảnh báo.",
                      "optionB": "Người bệnh luôn ổn định.",
                      "optionC": "Không cần theo dõi huyết áp.",
                      "optionD": "Chỉ cần hỏi triệu chứng đau.",
                      "correctAnswer": "A",
                      "explanation": "Đáp án A bám nguồn.",
                      "difficulty": "medium",
                      "topic": "Xuất huyết tiêu hóa",
                      "sourceExcerpt": "mạch nhanh và huyết áp tụt",
                      "knowledgePointId": "KP1"
                    },
                    {
                      "stem": "Dấu hiệu nào gợi ý người bệnh xuất huyết tiêu hóa cần được theo dõi sát?",
                      "optionA": "Mạch nhanh và huyết áp tụt.",
                      "optionB": "Ăn ngon hơn.",
                      "optionC": "Không đau.",
                      "optionD": "Ngủ sâu.",
                      "correctAnswer": "A",
                      "explanation": "Đáp án A bám nguồn.",
                      "difficulty": "medium",
                      "topic": "Xuất huyết tiêu hóa",
                      "sourceExcerpt": "mạch nhanh và huyết áp tụt",
                      "knowledgePointId": "KP1"
                    }
                  ]
                }
                """, LlmUsage.empty());

        assertThat(result.questions()).hasSize(1);
        assertThat(result.questions().get(0).stem()).startsWith("Dấu hiệu nào");
    }

    /**
     * Prompt cho phép model trả "0-8 knowledge point". Khi nó thật sự trả mảng rỗng kèm câu hỏi
     * hợp lệ, những câu đó PHẢI được giữ — chúng đã được sinh và đã tính tiền token.
     * {@code Stream.noneMatch} trên danh sách rỗng trả true nên nếu không chặn sẽ vứt sạch.
     */
    @Test
    void keepsQuestionsWhenTheModelReturnsNoKnowledgePointsAtAll() {
        GeneratedChunkResult result = generator.parseSingleCallResult("""
                {
                  "knowledgePoints": [],
                  "questions": [
                    {
                      "stem": "Dấu hiệu nào gợi ý người bệnh đang bị sốc phản vệ?",
                      "optionA": "Mạch nhanh, huyết áp tụt, khó thở.",
                      "optionB": "Ăn ngon miệng hơn.",
                      "optionC": "Ngủ sâu hơn bình thường.",
                      "optionD": "Da khô và ấm.",
                      "correctAnswer": "A",
                      "explanation": "Bám nguồn.",
                      "difficulty": "medium",
                      "topic": "Phản vệ",
                      "sourceExcerpt": "mạch nhanh, huyết áp tụt",
                      "knowledgePointId": null
                    },
                    {
                      "stem": "Thuốc đầu tay trong xử trí phản vệ là gì?",
                      "optionA": "Adrenalin.",
                      "optionB": "Paracetamol.",
                      "optionC": "Vitamin C.",
                      "optionD": "Kháng sinh.",
                      "correctAnswer": "A",
                      "explanation": "Bám nguồn.",
                      "difficulty": "easy",
                      "topic": "Phản vệ",
                      "sourceExcerpt": "adrenalin theo phác đồ",
                      "knowledgePointId": null
                    }
                  ]
                }
                """, LlmUsage.empty());

        assertThat(result.knowledgePoints()).isEmpty();
        assertThat(result.questions()).hasSize(2);
    }

    @Test
    void recordsTheModelActuallyUsedSoFallbackCallsArePricedCorrectly() {
        GeneratedChunkResult result = generator.parseSingleCallResult(
                "{\"knowledgePoints\":[],\"questions\":[]}",
                LlmUsage.empty(),
                "deepseek-v4-pro"
        );

        assertThat(result.model()).isEqualTo("deepseek-v4-pro");
        assertThat(result.model()).isNotEqualTo(properties.getModel());
    }

    @Test
    void classifiesHttpStatusCodesFromTheThrownRestClientException() {
        assertThat(generator.classifyError(unauthorized(HttpStatus.UNAUTHORIZED)))
                .isEqualTo(DeepSeekErrorType.AUTHENTICATION);
        assertThat(generator.classifyError(unauthorized(HttpStatus.FORBIDDEN)))
                .isEqualTo(DeepSeekErrorType.AUTHENTICATION);
        assertThat(generator.classifyError(unauthorized(HttpStatus.TOO_MANY_REQUESTS)))
                .isEqualTo(DeepSeekErrorType.RATE_LIMIT);
        assertThat(generator.classifyError(
                HttpServerErrorException.create(
                        HttpStatus.BAD_GATEWAY, "Bad Gateway", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8)))
                .isEqualTo(DeepSeekErrorType.SERVER_ERROR);
    }

    @Test
    void classifiesSocketTimeoutWrappedByRestClientAsTimeout() {
        ResourceAccessException wrapped = new ResourceAccessException(
                "I/O error", new SocketTimeoutException("Read timed out"));

        assertThat(generator.classifyError(wrapped)).isEqualTo(DeepSeekErrorType.TIMEOUT);
    }

    @Test
    void classifiesJsonParseFailureAsParseError() {
        assertThat(generator.classifyError(
                new IllegalStateException("DeepSeek trả về câu hỏi JSON không hợp lệ")))
                .isEqualTo(DeepSeekErrorType.PARSE_ERROR);
    }

    @Test
    void strictV4QuestionSchemaRejectsMissingDistractorRationales() {
        assertThatThrownBy(() -> generator.parseQuestionsStrict("""
                {"questions":[{
                  "questionType":"recall","stem":"Dấu hiệu nào cần theo dõi?",
                  "optionA":"A","optionB":"B","optionC":"C","optionD":"D",
                  "correctAnswer":"A","explanation":"Bám nguồn","difficulty":"easy",
                  "sourceExcerpt":"dấu hiệu","answerEvidence":"dấu hiệu","knowledgePointId":"KP1"
                }]}
                """))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("distractorRationales");
    }

    @Test
    void criticIsTriggeredForMedicationRiskWhenGroundingIsExact() {
        String chunk = "Adrenalin được tiêm bắp trong xử trí phản vệ.";
        GeneratedQuestion question = new GeneratedQuestion(
                "Thuốc nào được dùng trong xử trí phản vệ?",
                "Adrenalin", "Paracetamol", "Vitamin C", "Kháng sinh",
                "A", "Đáp án A bám nguồn.", "medium", "Phản vệ",
                "Adrenalin được tiêm bắp", "KP1", "{}", null,
                "FACT", "Adrenalin được tiêm bắp",
                "{\"B\":\"không được nguồn hỗ trợ\",\"C\":\"không được nguồn hỗ trợ\",\"D\":\"không được nguồn hỗ trợ\"}"
        );
        GenerationInput input = new GenerationInput(
                1L, 2L, 3L, chunk, "Phản vệ", 1, "vi",
                "guide.pdf", 1, 1, "Cấp cứu", null, "AUTO", "GROUNDED_V4"
        );
        GeneratedKnowledgePoint point = new GeneratedKnowledgePoint(
                "KP1", "Adrenalin được tiêm bắp.", "medication", "high",
                "Adrenalin được tiêm bắp", true, "{}"
        );

        assertThat(generator.shouldRunCritic(input, question, java.util.List.of(point))).isTrue();
    }

    @Test
    void criticIsTriggeredForMediumQuestionsEvenWithoutMedicalRiskKeywords() {
        String chunk = "Bước một là xác nhận thông tin. Bước hai là đối chiếu hồ sơ.";
        GeneratedQuestion question = new GeneratedQuestion(
                "Trình tự nào phù hợp?",
                "Xác nhận thông tin rồi đối chiếu hồ sơ",
                "Đối chiếu hồ sơ rồi xác nhận thông tin",
                "Chỉ xác nhận thông tin",
                "Chỉ đối chiếu hồ sơ",
                "A", "Đáp án A đúng trình tự.", "medium", "Quy trình",
                "Bước một là xác nhận thông tin", "KP1", "{}", null,
                "procedure", "Bước hai là đối chiếu hồ sơ",
                "{\"B\":\"đảo thứ tự\",\"C\":\"thiếu bước hai\",\"D\":\"thiếu bước một\"}"
        );
        GenerationInput input = new GenerationInput(
                1L, 2L, 3L, chunk, "Quy trình", 1, "vi",
                "guide.pdf", 1, 1, null, null, "MEDIUM", "GROUNDED_V4"
        );
        GeneratedKnowledgePoint point = new GeneratedKnowledgePoint(
                "KP1", "Quy trình gồm hai bước.", "procedure", "high",
                "Bước một là xác nhận thông tin", true, "{}"
        );

        assertThat(generator.shouldRunCritic(input, question, java.util.List.of(point))).isTrue();
    }

    @Test
    void strictCriticSchemaRequiresAntiGuessingSignals() {
        assertThatThrownBy(() -> generator.validateCriticJson("""
                {
                  "answerable":true,
                  "singleBestAnswer":true,
                  "correctAnswerSupported":true,
                  "distractorsInvalid":true,
                  "qualityScore":0.9,
                  "issues":[]
                }
                """))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("surfaceCueFree");
    }

    @Test
    void sendsJsonModeAndAccountsForCacheTokensAtActualModelPrice() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = successResponse(100, 40, 60, 20).getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            AiGenerationProperties local = apiProperties(server);
            DeepSeekDocumentQuestionGenerator localGenerator =
                    new DeepSeekDocumentQuestionGenerator(local, new ObjectMapper());

            GeneratedChunkResult result = localGenerator.generate(new GenerationInput(
                    1L, 2L, 3L, "Nội dung đủ nguồn.", "Mục", 1, "vi"));

            assertThat(requestBody.get()).contains("\"thinking\":{\"type\":\"disabled\"}")
                    .contains("\"response_format\":{\"type\":\"json_object\"}");
            assertThat(result.usage().promptCacheHitTokens()).isEqualTo(40);
            assertThat(result.usage().promptCacheMissTokens()).isEqualTo(60);
            assertThat(result.usage().estimatedCostUsd()).isCloseTo(
                    60 / 1_000_000.0 * 0.14 + 40 / 1_000_000.0 * 0.0028 + 20 / 1_000_000.0 * 0.28,
                    org.assertj.core.data.Offset.offset(0.000000001));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void retriesRateLimitThreeTimesButAuthenticationOpensCircuitImmediately() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            int call = calls.incrementAndGet();
            if (call <= 3) {
                exchange.getResponseHeaders().set("Retry-After", "0");
                exchange.sendResponseHeaders(429, -1);
            } else {
                byte[] body = successResponse(1, 0, 1, 1).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
            exchange.close();
        });
        server.start();
        try {
            DeepSeekDocumentQuestionGenerator localGenerator = new DeepSeekDocumentQuestionGenerator(
                    apiProperties(server), new ObjectMapper());
            localGenerator.generate(new GenerationInput(1L, 2L, 3L, "Nguồn", "Mục", 1, "vi"));
            assertThat(calls).hasValue(4);
        } finally {
            server.stop(0);
        }

        AtomicInteger authCalls = new AtomicInteger();
        HttpServer authServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        authServer.createContext("/chat/completions", exchange -> {
            authCalls.incrementAndGet();
            exchange.sendResponseHeaders(401, -1);
            exchange.close();
        });
        authServer.start();
        try {
            DeepSeekDocumentQuestionGenerator authGenerator = new DeepSeekDocumentQuestionGenerator(
                    apiProperties(authServer), new ObjectMapper());
            GenerationInput input = new GenerationInput(1L, 2L, 3L, "Nguồn", "Mục", 1, "vi");
            assertThatThrownBy(() -> authGenerator.generate(input)).isInstanceOf(RuntimeException.class);
            assertThatThrownBy(() -> authGenerator.generate(input)).hasMessageContaining("circuit breaker OPEN");
            assertThat(authCalls).hasValue(1);
        } finally {
            authServer.stop(0);
        }
    }

    @Test
    void keepsExactlyGroundedCandidateForHumanReviewWhenCriticIsUnavailable() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        String chunk = "Adrenalin được tiêm bắp trong xử trí phản vệ.";
        String knowledge = "{\"knowledgePoints\":[{\"id\":\"KP1\",\"statement\":\"Adrenalin được tiêm bắp\","
                + "\"type\":\"procedure\",\"importance\":\"high\",\"sourceExcerpt\":\"Adrenalin được tiêm bắp\","
                + "\"generationEligible\":true}]}";
        String question = "{\"questions\":[{\"questionType\":\"procedure\",\"stem\":\"Đường dùng nào phù hợp cho adrenalin trong xử trí phản vệ?\","
                + "\"optionA\":\"Tiêm bắp\",\"optionB\":\"Uống\",\"optionC\":\"Nhỏ mắt\",\"optionD\":\"Bôi da\","
                + "\"correctAnswer\":\"A\",\"explanation\":\"Nguồn nêu tiêm bắp.\",\"cognitiveLevel\":\"FOUNDATION\","
                + "\"professionalFieldCode\":\"CAP_CUU\",\"topic\":\"Phản vệ\","
                + "\"sourceExcerpt\":\"Adrenalin được tiêm bắp\",\"answerEvidence\":\"Adrenalin được tiêm bắp\","
                + "\"knowledgePointId\":\"KP1\",\"distractorRationales\":{\"B\":\"không khớp nguồn\","
                + "\"C\":\"không khớp nguồn\",\"D\":\"không khớp nguồn\"}}]}";
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            int call = calls.incrementAndGet();
            if (call == 3) {
                exchange.sendResponseHeaders(400, -1);
            } else {
                String content = call == 1 ? knowledge : question;
                byte[] body = jsonResponse(content).getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().set("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            }
            exchange.close();
        });
        server.start();
        try {
            AiGenerationProperties local = apiProperties(server);
            local.setCriticModel(local.getModel());
            DeepSeekDocumentQuestionGenerator localGenerator =
                    new DeepSeekDocumentQuestionGenerator(local, new ObjectMapper());
            GeneratedChunkResult result = localGenerator.generate(new GenerationInput(
                    1L, 2L, 3L, chunk, "Phản vệ", 1, "vi", "guide.pdf", 1, 1,
                    null, null, "AUTO", "GROUNDED_V4"));

            assertThat(result.questions()).hasSize(1);
            assertThat(result.criticCallCount()).isEqualTo(1);
            assertThat(result.questions().get(0).llmValidationJson()).contains("bắt buộc người duyệt");
            assertThat(calls).hasValue(3);
        } finally {
            server.stop(0);
        }
    }

    private static AiGenerationProperties apiProperties(HttpServer server) {
        AiGenerationProperties value = new AiGenerationProperties();
        value.setApiKey("test-key");
        value.setApiBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        value.setModel("deepseek-v4-flash");
        value.setFallbackModel("deepseek-v4-flash");
        value.setPipelineMode("single_call");
        value.setMaxRetries(1);
        return value;
    }

    private static String successResponse(int prompt, int hit, int miss, int completion) {
        return "{\"choices\":[{\"message\":{\"content\":\"{\\\"knowledgePoints\\\":[],\\\"questions\\\":[]}\"},"
                + "\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":" + prompt
                + ",\"prompt_cache_hit_tokens\":" + hit + ",\"prompt_cache_miss_tokens\":" + miss
                + ",\"completion_tokens\":" + completion + ",\"total_tokens\":" + (prompt + completion) + "}}";
    }

    private static String jsonResponse(String content) {
        String escaped = content.replace("\\", "\\\\").replace("\"", "\\\"");
        return "{\"choices\":[{\"message\":{\"content\":\"" + escaped
                + "\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":10,"
                + "\"completion_tokens\":10,\"total_tokens\":20}}";
    }

    private static HttpClientErrorException unauthorized(HttpStatus status) {
        return HttpClientErrorException.create(
                status, status.getReasonPhrase(), HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);
    }
}
