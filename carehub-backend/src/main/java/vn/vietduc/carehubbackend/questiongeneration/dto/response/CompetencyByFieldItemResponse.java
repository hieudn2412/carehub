package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record CompetencyByFieldItemResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        String departmentName,
        Integer attemptCount,
        BigDecimal averageScore,
        Integer passCount,
        Double passRate,
        boolean isPassed
) {
}
