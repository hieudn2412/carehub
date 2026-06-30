package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiEmbeddingProperties;
import vn.vietduc.carehubbackend.questiongeneration.config.AiParaphraseProperties;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.AiModelRuntimeStatusResponse;
import vn.vietduc.carehubbackend.questiongeneration.embedding.QuestionEmbeddingService;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AiModelRuntimeStatusServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void statusReportsE5FilesPresentWhenOnnxAndTokenizerExist() throws Exception {
        Path e5Root = tempDir.resolve("e5");
        Files.createDirectories(e5Root.resolve("onnx"));
        Files.writeString(e5Root.resolve("onnx").resolve("model.onnx"), "fake");
        Files.writeString(e5Root.resolve("onnx").resolve("tokenizer.json"), "{}");

        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("e5");
        embeddingProperties.setModelPath(e5Root);
        AiGenerationProperties generationProperties = new AiGenerationProperties();
        generationProperties.setProvider("api");
        generationProperties.setApiKey("test-key");
        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setProvider("mock");

        QuestionEmbeddingService embeddingService = mock(QuestionEmbeddingService.class);
        when(embeddingService.countApprovedStemEmbeddings()).thenReturn(270L);

        AiModelRuntimeStatusResponse status = new AiModelRuntimeStatusService(
                generationProperties,
                embeddingProperties,
                paraphraseProperties,
                embeddingService
        ).status();

        assertThat(status.generation().filesPresent()).isTrue();
        assertThat(status.generation().statusText()).isEqualTo("DeepSeek API sẵn sàng");
        assertThat(status.embedding().filesPresent()).isTrue();
        assertThat(status.embedding().statusText()).isEqualTo("Sẵn sàng, đã index 270 câu hỏi");
        assertThat(status.paraphrase().filesPresent()).isTrue();
        assertThat(status.paraphrase().statusText()).isEqualTo("Mock sẵn sàng");
    }

    @Test
    void statusReportsMissingE5Files() {
        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("e5");
        embeddingProperties.setModelPath(tempDir.resolve("missing"));
        AiGenerationProperties generationProperties = new AiGenerationProperties();
        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();

        AiModelRuntimeStatusResponse status = new AiModelRuntimeStatusService(
                generationProperties,
                embeddingProperties,
                paraphraseProperties,
                mock(QuestionEmbeddingService.class)
        ).status();

        assertThat(status.embedding().filesPresent()).isFalse();
        assertThat(status.embedding().statusText()).contains("Thiếu model");
    }

    @Test
    void statusRequiresVietQuillSeq2SeqFilesForRealProvider() throws Exception {
        Path vietQuillRoot = tempDir.resolve("vietquill");
        Files.createDirectories(vietQuillRoot);

        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("lexical");
        AiGenerationProperties generationProperties = new AiGenerationProperties();
        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setProvider("vietquill");
        paraphraseProperties.setModelPath(vietQuillRoot);

        AiModelRuntimeStatusResponse missingConfigStatus = new AiModelRuntimeStatusService(
                generationProperties,
                embeddingProperties,
                paraphraseProperties,
                mock(QuestionEmbeddingService.class)
        ).status();

        assertThat(missingConfigStatus.paraphrase().filesPresent()).isFalse();
        assertThat(missingConfigStatus.paraphrase().statusText()).contains("encoder/decoder");

        Files.writeString(vietQuillRoot.resolve("encoder_model.onnx"), "fake");
        Files.writeString(vietQuillRoot.resolve("decoder_model.onnx"), "fake");
        Files.writeString(vietQuillRoot.resolve("tokenizer.json"), "{}");
        Files.writeString(vietQuillRoot.resolve("config.json"), "{}");

        AiModelRuntimeStatusResponse readyStatus = new AiModelRuntimeStatusService(
                generationProperties,
                embeddingProperties,
                paraphraseProperties,
                mock(QuestionEmbeddingService.class)
        ).status();

        assertThat(readyStatus.paraphrase().filesPresent()).isTrue();
        assertThat(readyStatus.paraphrase().statusText()).isEqualTo("Sẵn sàng");
    }

    @Test
    void statusAcceptsSeparateQuestionAndSentenceVietQuillSubmodels() throws Exception {
        Path vietQuillRoot = tempDir.resolve("vietquill-dual");
        createSeq2SeqFiles(vietQuillRoot.resolve("question"));
        createSeq2SeqFiles(vietQuillRoot.resolve("sentence"));

        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("lexical");
        AiGenerationProperties generationProperties = new AiGenerationProperties();
        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setProvider("vietquill");
        paraphraseProperties.setModelPath(vietQuillRoot);

        AiModelRuntimeStatusResponse status = new AiModelRuntimeStatusService(
                generationProperties,
                embeddingProperties,
                paraphraseProperties,
                mock(QuestionEmbeddingService.class)
        ).status();

        assertThat(status.paraphrase().filesPresent()).isTrue();
        assertThat(status.paraphrase().statusText()).isEqualTo("Sẵn sàng");
    }

    @Test
    void statusReportsMissingDeepSeekApiKeyWhenApiProviderIsSelected() {
        AiGenerationProperties generationProperties = new AiGenerationProperties();
        generationProperties.setProvider("api");
        generationProperties.setApiKey("");
        AiEmbeddingProperties embeddingProperties = new AiEmbeddingProperties();
        embeddingProperties.setProvider("lexical");
        AiParaphraseProperties paraphraseProperties = new AiParaphraseProperties();
        paraphraseProperties.setProvider("mock");

        AiModelRuntimeStatusResponse status = new AiModelRuntimeStatusService(
                generationProperties,
                embeddingProperties,
                paraphraseProperties,
                mock(QuestionEmbeddingService.class)
        ).status();

        assertThat(status.generation().filesPresent()).isFalse();
        assertThat(status.generation().statusText()).contains("Thiếu");
    }

    private void createSeq2SeqFiles(Path root) throws Exception {
        Files.createDirectories(root);
        Files.writeString(root.resolve("encoder_model.onnx"), "fake");
        Files.writeString(root.resolve("decoder_model.onnx"), "fake");
        Files.writeString(root.resolve("tokenizer.json"), "{}");
        Files.writeString(root.resolve("config.json"), "{}");
    }
}
