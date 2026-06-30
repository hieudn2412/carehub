package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@EnabledIfEnvironmentVariable(named = "RUN_MODEL_SMOKE", matches = "true")
class E5EmbeddingModelSmokeTest {

    @Test
    void embedsVietnameseQuestionsWithLocalOnnxModel() {
        Path modelPath = Path.of("models", "intfloat", "multilingual-e5-small");
        assumeTrue(Files.exists(modelPath.resolve("onnx").resolve("model.onnx")));
        assumeTrue(Files.exists(modelPath.resolve("onnx").resolve("tokenizer.json")));

        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setModelPath(modelPath);
        properties.setPreload(false);

        E5EmbeddingModelService service = new E5EmbeddingModelService(properties);
        double[] left = service.embedQuery("Cần xác định người bệnh bằng tối thiểu hai thông tin nào?");
        double[] right = service.embedPassage("Người bệnh cần được xác định bằng tối thiểu hai thông tin nhận diện.");
        double[] unrelated = service.embedPassage("Chất thải lây nhiễm phải bỏ vào túi màu vàng.");
        service.close();

        assertThat(left).hasSize(384);
        assertThat(right).hasSize(384);
        assertThat(cosine(left, right)).isGreaterThan(cosine(left, unrelated));
    }

    private double cosine(double[] left, double[] right) {
        double dot = 0;
        double leftNorm = 0;
        double rightNorm = 0;
        for (int i = 0; i < Math.min(left.length, right.length); i++) {
            dot += left[i] * right[i];
            leftNorm += left[i] * left[i];
            rightNorm += right[i] * right[i];
        }
        return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
    }
}
