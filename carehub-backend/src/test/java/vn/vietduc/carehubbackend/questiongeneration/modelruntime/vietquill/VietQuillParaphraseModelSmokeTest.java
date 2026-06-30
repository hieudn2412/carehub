package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@EnabledIfEnvironmentVariable(named = "RUN_VIETQUILL_SMOKE", matches = "true")
class VietQuillParaphraseModelSmokeTest {

    @Test
    void paraphrasesFullMcqWithLocalOnnxSeq2SeqModel() {
        Path modelPath = Path.of(System.getenv().getOrDefault(
                "VIETQUILL_MODEL_PATH",
                Path.of("models", "ngwgsang", "vietquill-vit5-base-tsubaki").toString()
        ));
        assumeTrue(Files.isRegularFile(modelPath.resolve("encoder_model.onnx")));
        assumeTrue(Files.isRegularFile(modelPath.resolve("decoder_model.onnx")));
        assumeTrue(Files.isRegularFile(modelPath.resolve("tokenizer.json")));
        assumeTrue(Files.isRegularFile(modelPath.resolve("config.json")));

        AiParaphraseProperties properties = new AiParaphraseProperties();
        properties.setProvider("vietquill");
        properties.setModelPath(modelPath);
        properties.setPreload(false);
        properties.setMaxOutputLength(256);
        properties.setNumBeams(1);

        VietQuillParaphraseModelService service = new VietQuillParaphraseModelService(
                properties,
                new ObjectMapper()
        );
        String sourceStem = "Khi xác định người bệnh trước khi tiêm thuốc, điều dưỡng cần làm gì?";
        String sourceOptionA = "Đối chiếu ít nhất hai thông tin nhận diện.";
        List<ParaphrasedMcq> results = service.paraphrase(new ParaphraseModelInput(
                sourceStem,
                sourceOptionA,
                "Chỉ hỏi số phòng của người bệnh.",
                "Chỉ dựa vào vị trí giường hiện tại.",
                "Bỏ qua nếu người bệnh tỉnh táo.",
                "A",
                "medium",
                1
        ));
        service.close();

        assertThat(results).hasSize(1);
        ParaphrasedMcq candidate = results.get(0);
        assertThat(candidate.stem()).isNotBlank();
        assertThat(candidate.optionA()).isNotBlank();
        assertThat(candidate.optionB()).isNotBlank();
        assertThat(candidate.optionC()).isNotBlank();
        assertThat(candidate.optionD()).isNotBlank();
        assertThat(candidate.stem()).isNotEqualTo(sourceStem);
        assertThat(candidate.optionA()).isNotEqualTo(sourceOptionA);
    }
}
