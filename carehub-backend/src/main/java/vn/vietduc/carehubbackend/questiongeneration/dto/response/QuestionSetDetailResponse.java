package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record QuestionSetDetailResponse(
        Long id,
        String code,
        String name,
        String description,
        String cognitiveLevel,
        String status,
        String statusText,
        Integer questionCount,
        List<QuestionSetItemResponse> items,
        Integer activeVersion,
        LocalDateTime snapshotAt,
        List<QuestionSetVersionSummaryResponse> versions,
        List<QuestionSetSnapshotItemResponse> activeSnapshotItems,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        Long questionSetCategoryId,
        String questionSetCategoryCode,
        String questionSetCategoryName,
        Map<String, Integer> categoryCoverage,
        Map<String, Integer> cognitiveLevelCoverage
) {
    public QuestionSetDetailResponse(
            Long id, String code, String name, String description, String cognitiveLevel,
            String status, String statusText, Integer questionCount, List<QuestionSetItemResponse> items,
            Integer activeVersion, LocalDateTime snapshotAt, List<QuestionSetVersionSummaryResponse> versions,
            List<QuestionSetSnapshotItemResponse> activeSnapshotItems, LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this(id, code, name, description, cognitiveLevel, status, statusText, questionCount, items,
                activeVersion, snapshotAt, versions, activeSnapshotItems, createdAt, updatedAt,
                null, null, null, null, null, null, Map.of(), Map.of());
    }
}
