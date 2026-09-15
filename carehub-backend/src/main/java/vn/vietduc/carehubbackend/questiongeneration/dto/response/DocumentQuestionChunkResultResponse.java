package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record DocumentQuestionChunkResultResponse(
        Long id,
        Long chunkId,
        Integer chunkIndex,
        Integer attemptNo,
        String status,
        Integer knowledgePointCount,
        Integer rawQuestionCount,
        Integer reviewableCount,
        Integer rejectedCount,
        Integer criticCallCount,
        Integer repairCallCount,
        Integer llmCallCount,
        Integer promptTokens,
        Integer promptCacheHitTokens,
        Integer promptCacheMissTokens,
        Integer completionTokens,
        Integer totalTokens,
        Long latencyMs,
        Double estimatedCostUsd,
        String errorCode,
        String errorMessage,
        boolean retryable
) {
}
