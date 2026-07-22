package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record DepartmentCompetencyTargetResponse(
        Long departmentId,
        String departmentName,
        BigDecimal targetScore
) {
}
