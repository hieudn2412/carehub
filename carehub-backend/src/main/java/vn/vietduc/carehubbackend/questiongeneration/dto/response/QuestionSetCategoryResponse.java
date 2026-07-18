package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionSetCategoryResponse(
        Long id,
        String code,
        String name,
        String description,
        String status,
        String statusText,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
