package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record CompetencyEmployeeByTechniqueResponse(
        Long employeeId,
        String employeeName,
        String employeeCode,
        Long departmentId,
        String departmentName,
        String fromDate,
        String toDate,
        double complianceTarget,
        BigDecimal overallAverageScore,
        List<SkillCompetencyItemResponse> items
) {
}
