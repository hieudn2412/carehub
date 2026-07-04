package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record DocumentQuestionJobSummaryResponse(
        Long id,
        String status,
        String statusText,
        String provider,
        String model,
        Integer candidateCount,
        Integer chunkCount,
        Integer completedChunkCount,
        Integer failedChunkCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
