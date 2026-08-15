package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionSetSummaryResponse(
        Long id,
        String code,
        String name,
        String description,
        String cognitiveLevel,
        String status,
        String statusText,
        Integer questionCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        Long questionSetCategoryId,
        String questionSetCategoryCode,
        String questionSetCategoryName
) {
    public QuestionSetSummaryResponse(
            Long id, String code, String name, String description, String cognitiveLevel,
            String status, String statusText, Integer questionCount, LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this(id, code, name, description, cognitiveLevel, status, statusText, questionCount,
                createdAt, updatedAt, null, null, null, null, null, null);
    }
}
