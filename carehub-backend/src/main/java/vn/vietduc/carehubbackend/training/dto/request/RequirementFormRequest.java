package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RequirementFormRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        @NotNull @DecimalMin("0.0") @DecimalMax("500.0") BigDecimal requiredHours,
        @NotNull @Min(1) Integer cycleYears,
        Long jobPositionId,
        Long departmentId,
        Long professionalFieldId,
        @DecimalMin("0.0") BigDecimal warningThresholdHours,
        @NotNull LocalDate effectiveFrom,
        LocalDate effectiveTo,
        Boolean active,
        Long version
) {
}
