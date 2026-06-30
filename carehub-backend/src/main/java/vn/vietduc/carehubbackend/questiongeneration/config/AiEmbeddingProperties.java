package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@Getter
@Setter
@ConfigurationProperties(prefix = "ai.embedding")
public class AiEmbeddingProperties {
    private String provider = "lexical";
    private String model = "intfloat/multilingual-e5-small";
    private int dimension = 384;
    private Path modelPath = Path.of("models", "intfloat", "multilingual-e5-small");
    private boolean preload = true;
    private boolean backfillOnStartup = true;
    private int maxLength = 512;
    private int timeoutSeconds = 30;
    private String fallbackProvider = "lexical";

    public boolean isE5Provider() {
        return "e5".equalsIgnoreCase(provider);
    }
}
