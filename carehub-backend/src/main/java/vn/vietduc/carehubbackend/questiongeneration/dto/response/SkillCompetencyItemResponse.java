package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record SkillCompetencyItemResponse(
        Long formId,
        String formName,
        Integer evaluationCount,
        BigDecimal averageScore,
        Integer passCount,
        Double passRate,
        String competencyLevel,
        String competencyLabel,
        String colorHex,
        boolean isPassed
) {
}
