package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "document")
public class DocumentProcessingProperties {
    private Path storagePath = Path.of("storage", "documents");
    private List<String> supportedFileTypes = new ArrayList<>(List.of("pdf", "docx", "txt", "md"));
    private int questionsPerChunk = 1;
    private Chunk chunk = new Chunk();

    @Getter
    @Setter
    public static class Chunk {
        private int targetTokens = 750;
        private int maxTokens = 1200;
        private int overlapTokens = 80;
        private int minUsefulTextLength = 80;
    }
}
