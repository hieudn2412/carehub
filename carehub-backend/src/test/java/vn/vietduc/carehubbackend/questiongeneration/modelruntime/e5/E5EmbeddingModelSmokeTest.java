package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

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

    /**
     * Vector nhúng theo LÔ phải khớp vector nhúng TỪNG CÂU của cùng văn bản đó.
     *
     * <p>Đây là bất biến sống còn: câu trong ngân hàng được nhúng theo lô (backfill) còn câu
     * ứng viên được nhúng từng câu (kiểm tra trùng lúc chạy). Nếu hai đường cho vector khác
     * nhau thì mọi ngưỡng trùng lặp đang so hai loại vector không cùng hệ quy chiếu.</p>
     *
     * <p>Lô ở đây cố tình trộn câu rất ngắn với câu rất dài để tạo nhiều padding — đó là chỗ
     * lỗi mask lộ ra. Nếu mean-pool tính nhầm cả vị trí padding vào trung bình thì câu NGẮN
     * NHẤT trong lô sẽ lệch nhiều nhất.</p>
     */
    @Test
    void batchEmbeddingMatchesSingleEmbeddingEvenWithHeavyPadding() {
        Path modelPath = Path.of("models", "intfloat", "multilingual-e5-small");
        assumeTrue(Files.exists(modelPath.resolve("onnx").resolve("model.onnx")));
        assumeTrue(Files.exists(modelPath.resolve("onnx").resolve("tokenizer.json")));

        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setModelPath(modelPath);
        properties.setPreload(false);
        properties.setBatchSize(8);

        List<String> texts = List.of(
                "Rửa tay.",
                "Người bệnh cần được xác định bằng tối thiểu hai thông tin nhận diện trước khi thực hiện"
                        + " bất kỳ thủ thuật xâm lấn nào, bao gồm họ tên đầy đủ và ngày tháng năm sinh,"
                        + " đối chiếu với vòng đeo tay và hồ sơ bệnh án để tránh nhầm lẫn người bệnh.",
                "Chất thải lây nhiễm bỏ vào túi màu vàng.",
                "Khi phát hiện người bệnh có dấu hiệu phản vệ, điều dưỡng phải ngừng ngay tác nhân nghi ngờ,"
                        + " gọi hỗ trợ và tiêm adrenalin theo phác đồ đã được phê duyệt."
        );

        E5EmbeddingModelService service = new E5EmbeddingModelService(properties);
        try {
            List<double[]> batched = service.embedSymmetricBatch(texts);
            assertThat(batched).hasSameSizeAs(texts);

            for (int i = 0; i < texts.size(); i++) {
                double[] single = service.embedSymmetric(texts.get(i));
                double agreement = cosine(batched.get(i), single);
                assertThat(agreement)
                        .as("câu %d (%d ký tự) — lô và đơn lẻ phải cho cùng một vector", i, texts.get(i).length())
                        .isGreaterThan(0.999);
            }
        } finally {
            service.close();
        }
    }

    /**
     * Batch sắp xếp lại thứ tự nội bộ theo độ dài rồi khôi phục — nếu khôi phục sai,
     * vector của câu i sẽ là vector của câu khác. Kiểm tra bằng cách khẳng định vector
     * theo lô của mỗi câu gần với chính nó hơn mọi câu còn lại.
     */
    @Test
    void batchPreservesInputOrder() {
        Path modelPath = Path.of("models", "intfloat", "multilingual-e5-small");
        assumeTrue(Files.exists(modelPath.resolve("onnx").resolve("model.onnx")));
        assumeTrue(Files.exists(modelPath.resolve("onnx").resolve("tokenizer.json")));

        AiEmbeddingProperties properties = new AiEmbeddingProperties();
        properties.setProvider("e5");
        properties.setModelPath(modelPath);
        properties.setPreload(false);
        properties.setBatchSize(4);

        // Cố tình xếp theo độ dài GIẢM DẦN để bước sắp xếp bên trong phải đảo thứ tự thật sự.
        List<String> texts = List.of(
                "Quy trình vệ sinh tay thường quy gồm nhiều bước và phải thực hiện đủ thời gian tối thiểu.",
                "Chất thải lây nhiễm phải bỏ vào túi màu vàng theo quy định.",
                "Đo mạch và huyết áp cho người bệnh.",
                "Rửa tay."
        );

        E5EmbeddingModelService service = new E5EmbeddingModelService(properties);
        try {
            List<double[]> batched = service.embedSymmetricBatch(texts);

            for (int i = 0; i < texts.size(); i++) {
                double[] single = service.embedSymmetric(texts.get(i));
                double self = cosine(batched.get(i), single);
                for (int other = 0; other < texts.size(); other++) {
                    if (other == i) {
                        continue;
                    }
                    assertThat(self)
                            .as("vector theo lô của câu %d phải giống câu %d hơn câu %d", i, i, other)
                            .isGreaterThan(cosine(batched.get(other), single));
                }
            }
        } finally {
            service.close();
        }
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
