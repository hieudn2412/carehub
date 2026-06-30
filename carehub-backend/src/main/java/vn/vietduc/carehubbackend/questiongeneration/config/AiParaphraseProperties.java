package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@Getter
@Setter
@ConfigurationProperties(prefix = "ai.paraphrase")
public class AiParaphraseProperties {
    private String provider = "vietquill";
    private String model = "ngwgsang/vietquill-vit5-base-tsubaki";
    private Path modelPath = Path.of("models", "ngwgsang", "vietquill-vit5-base-tsubaki");
    private boolean preload = false;
    private int maxInputLength = 512;
    private int maxOutputLength = 512;
    private int timeoutSeconds = 60;
    private int numBeams = 4;
    private int requestedCountDefault = 3;

    public boolean isVietQuillProvider() {
        return "vietquill".equalsIgnoreCase(provider) || "local".equalsIgnoreCase(provider);
    }

    public boolean isMockProvider() {
        return "mock".equalsIgnoreCase(provider);
    }
}
