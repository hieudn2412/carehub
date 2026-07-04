package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record DocumentResponse(
        Long id,
        String filename,
        String contentType,
        String status,
        String statusText,
        Integer pageCount,
        Integer chunkCount,
        String contentHash,
        String errorMessage,
        Long questionJobCount,
        DocumentQuestionJobSummaryResponse latestQuestionJob,
        List<DocumentSectionResponse> sections,
        List<DocumentChunkResponse> chunks,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
