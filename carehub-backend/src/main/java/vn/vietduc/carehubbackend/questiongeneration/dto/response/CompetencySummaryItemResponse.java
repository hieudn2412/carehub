package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record CompetencySummaryItemResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        BigDecimal knowledgeAverage,
        BigDecimal skillAverage,
        BigDecimal overallScore,
        String competencyLevel,
        String competencyLabel,
        String colorHex,
        boolean isPassed
) {
}
