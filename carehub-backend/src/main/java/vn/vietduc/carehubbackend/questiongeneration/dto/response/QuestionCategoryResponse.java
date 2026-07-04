package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionCategoryResponse(
        Long id,
        String code,
        String name,
        String description,
        String status,
        String statusText,
        Integer sortOrder,
        long questionCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
