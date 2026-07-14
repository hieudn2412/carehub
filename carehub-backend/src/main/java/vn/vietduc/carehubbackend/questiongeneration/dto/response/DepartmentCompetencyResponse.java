package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record DepartmentCompetencyResponse(
        Long departmentId,
        String departmentName,
        Integer totalEmployees,
        Integer classifiedEmployees,
        List<CompetencyLevelCountResponse> levelDistribution,
        List<CompetencyClassificationResponse> employees
) {
}
