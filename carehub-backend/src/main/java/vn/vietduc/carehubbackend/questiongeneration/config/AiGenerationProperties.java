package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "ai.generation")
public class AiGenerationProperties {
    private String provider = "mock";
    private String apiBaseUrl = "https://api.deepseek.com";
    private String apiKey;
    private String model = "deepseek-v4-flash";
    private String fallbackModel = "deepseek-v4-pro";
    private String promptVersion = "docgen-mvp-flash-v2";
    private String pipelineMode = "single_call";
    private int timeoutSeconds = 60;
    private int connectTimeoutSeconds = 10;
    private int maxConnections = 10;
    private int maxRetries = 1;
    private int maxConcurrentCalls = 2;
    private int circuitBreakerFailureThreshold = 5;
    private int circuitBreakerCooldownSeconds = 60;
    private double temperature = 0.7;
    private double topP = 0.9;
    private int maxOutputTokens = 1800;
    private boolean llmValidationEnabled = true;
    private boolean parallelChunkProcessing = true;
    private int chunkParallelism = -1;
    private double inputPricePerMillion = 0.14;
    private double outputPricePerMillion = 0.56;
    private double fallbackInputPricePerMillion = 0.55;
    private double fallbackOutputPricePerMillion = 2.20;

    public boolean isApiProvider() {
        return "api".equalsIgnoreCase(provider);
    }
}
