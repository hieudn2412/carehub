package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionCategoryResponse(
        Long id,
        String code,
        String name,
        String description,
        String status,
        String statusText,
        long questionCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName
) {
    public QuestionCategoryResponse(
            Long id,
            String code,
            String name,
            String description,
            String status,
            String statusText,
            long questionCount,
            LocalDateTime createdAt,
            LocalDateTime updatedAt
    ) {
        this(id, code, name, description, status, statusText, questionCount, createdAt, updatedAt, null, null, null);
    }
}
