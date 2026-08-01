package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record DocumentQuestionJobSummaryResponse(
        Long id,
        String status,
        String statusText,
        String provider,
        String model,
        String pipelineVersion,
        String promptVersion,
        Integer candidateCount,
        Integer reviewableCandidateCount,
        Integer rejectedCandidateCount,
        Integer problemChunkCount,
        Integer chunkCount,
        Integer completedChunkCount,
        Integer failedChunkCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
