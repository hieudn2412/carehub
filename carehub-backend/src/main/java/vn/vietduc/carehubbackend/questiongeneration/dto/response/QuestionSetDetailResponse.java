package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record QuestionSetDetailResponse(
        Long id,
        String code,
        String name,
        String description,
        String category,
        String difficulty,
        String status,
        String statusText,
        Integer questionCount,
        List<QuestionSetItemResponse> items,
        Integer activeVersion,
        LocalDateTime snapshotAt,
        List<QuestionSetVersionSummaryResponse> versions,
        List<QuestionSetSnapshotItemResponse> activeSnapshotItems,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
