package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.AiModelRuntimeStatusResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;

import java.nio.file.Files;
import java.nio.file.Path;

@Service
@RequiredArgsConstructor
public class AiModelRuntimeStatusService {
    private final AiGenerationProperties generationProperties;
    private final AiEmbeddingProperties embeddingProperties;
    private final AiParaphraseProperties paraphraseProperties;
    private final QuestionEmbeddingService embeddingService;

    public AiModelRuntimeStatusResponse status() {
        return new AiModelRuntimeStatusResponse(
                generationStatus(),
                embeddingStatus(),
                paraphraseStatus()
        );
    }

    private AiModelRuntimeStatusResponse.ModelStatus generationStatus() {
        boolean ready = !"api".equalsIgnoreCase(generationProperties.getProvider())
                || StringUtils.hasText(generationProperties.getApiKey());
        String statusText;
        if ("mock".equalsIgnoreCase(generationProperties.getProvider())) {
            statusText = "Mock generator";
        } else if ("api".equalsIgnoreCase(generationProperties.getProvider())) {
            statusText = ready
                    ? "DeepSeek API sẵn sàng"
                    : "Thiếu GENERATION_API_KEY hoặc DEEPSEEK_API_KEY";
        } else {
            statusText = "Provider tạo câu hỏi chưa được hỗ trợ đầy đủ";
        }
        return new AiModelRuntimeStatusResponse.ModelStatus(
                generationProperties.getProvider(),
                generationProperties.getModel(),
                generationProperties.getApiBaseUrl(),
                false,
                ready,
                statusText
        );
    }

    private AiModelRuntimeStatusResponse.ModelStatus embeddingStatus() {
        boolean filesPresent = !embeddingProperties.isE5Provider()
                || hasE5Files(embeddingProperties.getModelPath());
        long indexedCount = embeddingService.countApprovedStemEmbeddings();
        String statusText = embeddingStatusText(filesPresent, indexedCount);
        return new AiModelRuntimeStatusResponse.ModelStatus(
                embeddingProperties.getProvider(),
                embeddingProperties.getModel(),
                embeddingProperties.getModelPath().toString(),
                embeddingProperties.isPreload(),
                filesPresent,
                statusText
        );
    }

    private String embeddingStatusText(boolean filesPresent, long indexedCount) {
        if (!filesPresent) {
            return "Thiếu model ONNX hoặc tokenizer E5";
        }
        if (!embeddingProperties.isE5Provider()) {
            return "Kiểm tra từ khóa";
        }
        if (indexedCount == 0) {
            return "Sẵn sàng, chưa index câu hỏi";
        }
        return "Sẵn sàng, đã index " + indexedCount + " câu hỏi";
    }

    private AiModelRuntimeStatusResponse.ModelStatus paraphraseStatus() {
        boolean filesPresent = paraphraseProperties.isMockProvider()
                || hasVietQuillSeq2SeqFiles(paraphraseProperties.getModelPath());
        String statusText = paraphraseProperties.isMockProvider()
                ? "Mock sẵn sàng"
                : filesPresent ? "Sẵn sàng" : "Thiếu encoder/decoder/tokenizer/config VietQuill ONNX";
        return new AiModelRuntimeStatusResponse.ModelStatus(
                paraphraseProperties.getProvider(),
                paraphraseProperties.getModel(),
                paraphraseProperties.getModelPath().toString(),
                paraphraseProperties.isPreload(),
                filesPresent,
                statusText
        );
    }

    private boolean hasE5Files(Path root) {
        return (Files.isRegularFile(root.resolve("model.onnx"))
                || Files.isRegularFile(root.resolve("onnx").resolve("model.onnx")))
                && (Files.isRegularFile(root.resolve("tokenizer.json"))
                || Files.isRegularFile(root.resolve("onnx").resolve("tokenizer.json")));
    }

    private boolean hasVietQuillSeq2SeqFiles(Path root) {
        return hasSingleSeq2SeqModel(root)
                || (hasSingleSeq2SeqModel(root.resolve("question"))
                && hasSingleSeq2SeqModel(root.resolve("sentence")));
    }

    private boolean hasSingleSeq2SeqModel(Path root) {
        return Files.isDirectory(root)
                && hasRegularFile(root, "encoder_model.onnx", "onnx/encoder_model.onnx", "encoder.onnx", "onnx/encoder.onnx")
                && hasRegularFile(root, "decoder_model.onnx", "onnx/decoder_model.onnx", "decoder.onnx", "onnx/decoder.onnx")
                && hasRegularFile(root, "tokenizer.json", "onnx/tokenizer.json")
                && hasRegularFile(root, "config.json", "onnx/config.json");
    }

    private boolean hasRegularFile(Path root, String... relativePaths) {
        for (String relativePath : relativePaths) {
            if (Files.isRegularFile(root.resolve(relativePath))) {
                return true;
            }
        }
        return false;
    }
}
