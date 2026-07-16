package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record KnowledgeCompetencyItemResponse(
        Long categoryId,
        String categoryName,
        Integer attemptCount,
        BigDecimal averageScore,
        Integer passCount,
        Double passRate,
        String competencyLevel,
        String competencyLabel,
        String colorHex,
        boolean isPassed
) {
}
