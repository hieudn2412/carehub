package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GeneratedQuestion;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;
import vn.vietduc.carehubbackend.questiongeneration.service.model.LlmUsage;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class MockDocumentQuestionGenerator implements DocumentQuestionGenerator {
    private final AiGenerationProperties properties;
    private final ObjectMapper objectMapper;

    @Override
    public String provider() {
        return "mock";
    }

    @Override
    public GeneratedChunkResult generate(GenerationInput input) {
        String excerpt = excerpt(input.chunkText(), 420);
        GeneratedKnowledgePoint knowledgePoint = new GeneratedKnowledgePoint(
                "KP1",
                firstSentence(input.chunkText()),
                "fact",
                "medium",
                excerpt,
                true,
                toJson(Map.of("id", "KP1", "provider", "mock"))
        );

        List<GeneratedQuestion> questions = new ArrayList<>();
        for (int i = 0; i < input.questionsPerChunk(); i++) {
            String stem = "Theo tài liệu, nhận định nào sau đây phù hợp nhất với nội dung trong mục \"" + input.sectionPath() + "\"?";
            questions.add(new GeneratedQuestion(
                    stem,
                    firstSentence(input.chunkText()),
                    "Có thể bỏ qua nội dung này nếu đã quen quy trình.",
                    "Chỉ áp dụng khi tài liệu không có trích dẫn nguồn.",
                    "Không cần người duyệt trước khi đưa vào ngân hàng câu hỏi.",
                    "A",
                    "Đáp án A bám trực tiếp vào trích dẫn nguồn của chunk.",
                    i == 0 ? "easy" : "medium",
                    input.sectionPath(),
                    excerpt,
                    "KP1",
                    toJson(Map.of("mockIndex", i)),
                    toJson(Map.of(
                            "answerable", true,
                            "singleBestAnswer", true,
                            "correctAnswerSupported", true,
                            "qualityScore", 0.82,
                            "issues", List.of()
                    ))
            ));
        }

        return new GeneratedChunkResult(
                provider(),
                properties.getModel(),
                properties.getPromptVersion(),
                new LlmUsage(0, 0, 0, 0, 0),
                List.of(knowledgePoint),
                questions
        );
    }

    private String firstSentence(String text) {
        String normalized = excerpt(text, 260);
        int end = normalized.indexOf('.');
        if (end > 40) {
            return normalized.substring(0, end + 1);
        }
        return normalized;
    }

    private String excerpt(String text, int limit) {
        if (text == null) {
            return "";
        }
        String normalized = text.replaceAll("\\s+", " ").trim();
        return normalized.length() <= limit ? normalized : normalized.substring(0, limit).trim();
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }
}
