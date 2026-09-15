package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record DocumentQuestionJobResponse(
        Long id,
        Long documentId,
        String provider,
        String model,
        String promptVersion,
        String promptHash,
        String pipelineVersion,
        String targetCognitiveLevel,
        Integer cognitiveMixFoundation,
        Integer cognitiveMixApplication,
        Integer cognitiveMixReasoning,
        String status,
        String statusText,
        Integer questionsPerChunk,
        Integer chunkCount,
        Integer completedChunkCount,
        Integer failedChunkCount,
        Integer candidateCount,
        Integer eligibleChunkCount,
        Integer skippedChunkCount,
        Integer problemChunkCount,
        Integer reviewableCandidateCount,
        Integer rejectedCandidateCount,
        Integer criticCallCount,
        String chunkErrors,
        UsageResponse usage,
        String errorMessage,
        List<KnowledgePointResponse> knowledgePoints,
        List<DocumentQuestionCandidateResponse> candidates,
        List<DocumentQuestionChunkResultResponse> chunkResults,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
