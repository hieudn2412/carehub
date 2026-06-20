package vn.vietduc.carehubbackend.training.dto.request;

import java.time.LocalDate;

public record RequirementSearchRequest(
        String keyword,
        Boolean active,
        Long departmentId,
        Long jobPositionId,
        Long professionalFieldId,
        LocalDate effectiveOn
) {
}
