package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record CategoryClassificationResponse(
        Long categoryId,
        String categoryName,
        String level,
        String levelText,
        String levelColor,
        BigDecimal averageScore,
        Integer totalQuestions,
        Integer totalAttempts
) {
}
