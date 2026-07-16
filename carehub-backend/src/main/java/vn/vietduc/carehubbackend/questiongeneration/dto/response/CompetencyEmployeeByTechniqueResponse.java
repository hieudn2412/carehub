package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record CompetencyEmployeeByTechniqueResponse(
        Long employeeId,
        String employeeName,
        String employeeCode,
        String fromDate,
        String toDate,
        List<SkillCompetencyItemResponse> items
) {
}
