package vn.vietduc.carehubbackend.questiongeneration.generation;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DocumentQuestionGeneratorRouter {
    private final AiGenerationProperties properties;
    private final List<DocumentQuestionGenerator> generators;

    public DocumentQuestionGenerator current() {
        return generators.stream()
                .filter(generator -> generator.provider().equalsIgnoreCase(properties.getProvider()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Chưa cấu hình provider tạo câu hỏi: " + properties.getProvider()));
    }
}
