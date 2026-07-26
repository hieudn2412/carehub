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
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

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

    private static HttpClientErrorException unauthorized(HttpStatus status) {
        return HttpClientErrorException.create(
                status, status.getReasonPhrase(), HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);
    }
}
