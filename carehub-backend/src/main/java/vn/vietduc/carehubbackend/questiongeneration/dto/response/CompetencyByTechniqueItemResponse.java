package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record CompetencyByTechniqueItemResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        String departmentName,
        Integer evaluationCount,
        BigDecimal averageScore,
        Integer passCount,
        Double passRate,
        boolean isPassed,
        boolean belowTarget
) {
}
