package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

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
}
