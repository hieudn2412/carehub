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
        String competencyLevel,
        String competencyLabel,
        String colorHex,
        boolean isPassed,
        boolean belowTarget
) {
}
