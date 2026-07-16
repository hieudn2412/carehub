package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record CompetencyByFieldItemResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
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
