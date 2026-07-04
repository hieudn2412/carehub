package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionClassificationRuleResponse(
        Long id,
        String name,
        Long categoryId,
        String categoryName,
        String keywords,
        String sourcePattern,
        Integer priority,
        Boolean enabled,
        String statusText,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
