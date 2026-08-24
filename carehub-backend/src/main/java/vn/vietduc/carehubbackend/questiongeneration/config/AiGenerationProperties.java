package vn.vietduc.carehubbackend.questiongeneration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationPipelineVersion;

@Getter
@Setter
@ConfigurationProperties(prefix = "ai.generation")
public class AiGenerationProperties {
    private String provider = "mock";
    private String apiBaseUrl = "https://api.deepseek.com";
    private String apiKey;
    private String model = "deepseek-v4-flash";
    private String fallbackModel = "deepseek-v4-pro";
    private String promptVersion = "docgen-mvp-flash-v4";
    private String pipelineMode = "single_call";
    private GenerationPipelineVersion defaultPipeline = GenerationPipelineVersion.GROUNDED_V4;
    private boolean groundedV4Enabled = true;
    private boolean allowLegacyNewJobs = false;
    private int timeoutSeconds = 60;
    private int connectTimeoutSeconds = 10;
    private int maxConnections = 10;
    private int maxRetries = 1;
    private int maxConcurrentCalls = 2;
    private int circuitBreakerFailureThreshold = 5;
    private int circuitBreakerCooldownSeconds = 60;
    private double temperature = 0.7;
    private double topP = 0.9;
    private int maxOutputTokens = 3200;
    private boolean llmValidationEnabled = true;
    private boolean parallelChunkProcessing = true;
    private int chunkParallelism = -1;
    private double inputPricePerMillion = 0.14;
    private double outputPricePerMillion = 0.28;
    private double fallbackInputPricePerMillion = 0.435;
    private double fallbackOutputPricePerMillion = 0.87;
    private double cacheHitInputPricePerMillion = 0.0028;
    private double fallbackCacheHitInputPricePerMillion = 0.003625;
    private String criticModel = "deepseek-v4-pro";
    private double knowledgeTemperature = 0.1;
    private double questionTemperature = 0.3;
    private double criticTemperature = 0.0;
    private int knowledgeMaxOutputTokens = 1200;
    private int questionMaxOutputTokens = 1800;
    private int criticMaxOutputTokens = 900;

    public boolean isApiProvider() {
        return "api".equalsIgnoreCase(provider);
    }
}
