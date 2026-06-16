package vn.vietduc.carehubbackend.training.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RequirementListResponse(
        Long id,
        String code,
        String name,
        BigDecimal requiredHours,
        Integer cycleYears,
        Long departmentId,
        String departmentName,
        Long jobPositionId,
        String jobPositionName,
        Long professionalFieldId,
        String professionalFieldName,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        boolean active,
        Long version
) {
}
