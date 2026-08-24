package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record CompetencySummaryItemResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        String departmentName,
        BigDecimal examScore,
        Integer examAttemptCount,
        BigDecimal knowledgeAverage,
        BigDecimal skillAverage,
        BigDecimal overallScore,
        boolean isPassed
) {
}
