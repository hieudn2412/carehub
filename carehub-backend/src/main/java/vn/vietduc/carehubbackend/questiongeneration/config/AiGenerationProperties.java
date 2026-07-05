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
    private String promptVersion = "docgen-mvp-flash-v1";
    private String pipelineMode = "single_call";
    private int timeoutSeconds = 60;
    private int maxRetries = 1;
    private int maxConcurrentCalls = 2;
    private int circuitBreakerFailureThreshold = 5;
    private int circuitBreakerCooldownSeconds = 60;
    private double temperature = 0.2;
    private int maxOutputTokens = 1800;
    private boolean llmValidationEnabled = true;

    public boolean isApiProvider() {
        return "api".equalsIgnoreCase(provider);
    }
}
