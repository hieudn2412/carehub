package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record UsageResponse(
        Integer callCount,
        Integer promptTokens,
        Integer promptCacheHitTokens,
        Integer promptCacheMissTokens,
        Integer completionTokens,
        Integer totalTokens,
        Long latencyMs,
        Double estimatedCostUsd
) {
}
