package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record LlmUsage(
        int callCount,
        int promptTokens,
        int completionTokens,
        int totalTokens,
        long latencyMs
) {
    public static LlmUsage empty() {
        return new LlmUsage(0, 0, 0, 0, 0);
    }

    public LlmUsage plus(LlmUsage other) {
        return new LlmUsage(
                callCount + other.callCount(),
                promptTokens + other.promptTokens(),
                completionTokens + other.completionTokens(),
                totalTokens + other.totalTokens(),
                latencyMs + other.latencyMs()
        );
    }
}
