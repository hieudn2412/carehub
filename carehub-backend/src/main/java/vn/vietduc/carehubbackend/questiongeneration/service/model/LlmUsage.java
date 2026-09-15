package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record LlmUsage(
        int callCount,
        int promptTokens,
        int completionTokens,
        int totalTokens,
        long latencyMs,
        int promptCacheHitTokens,
        int promptCacheMissTokens,
        double estimatedCostUsd
) {
    public LlmUsage(int callCount, int promptTokens, int completionTokens, int totalTokens, long latencyMs) {
        this(callCount, promptTokens, completionTokens, totalTokens, latencyMs, 0, promptTokens, 0.0);
    }

    public static LlmUsage empty() {
        return new LlmUsage(0, 0, 0, 0, 0, 0, 0, 0.0);
    }

    public LlmUsage plus(LlmUsage other) {
        return new LlmUsage(
                callCount + other.callCount(),
                promptTokens + other.promptTokens(),
                completionTokens + other.completionTokens(),
                totalTokens + other.totalTokens(),
                latencyMs + other.latencyMs(),
                promptCacheHitTokens + other.promptCacheHitTokens(),
                promptCacheMissTokens + other.promptCacheMissTokens(),
                estimatedCostUsd + other.estimatedCostUsd()
        );
    }
}
