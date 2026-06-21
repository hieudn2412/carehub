package vn.vietduc.carehubbackend.training.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record RequirementDetailResponse(
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
        BigDecimal warningThresholdHours,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        boolean active,
        long applicableEmployeeCount,
        Long createdByUserId,
        Long updatedByUserId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long version
) {
}
