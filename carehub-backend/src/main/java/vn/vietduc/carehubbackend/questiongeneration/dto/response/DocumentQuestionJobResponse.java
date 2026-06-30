package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record DocumentQuestionJobResponse(
        Long id,
        Long documentId,
        String provider,
        String model,
        String promptVersion,
        String status,
        String statusText,
        Integer questionsPerChunk,
        Integer chunkCount,
        Integer completedChunkCount,
        Integer failedChunkCount,
        Integer candidateCount,
        String chunkErrors,
        UsageResponse usage,
        String errorMessage,
        List<KnowledgePointResponse> knowledgePoints,
        List<DocumentQuestionCandidateResponse> candidates,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
