package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;

public record ActivityTypeFormRequest(
        @NotBlank @Size(min = 2, max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 2000) String description,
        @NotNull DurationUnit defaultDurationUnit,
        boolean requiresEvidence,
        @DecimalMin(value = "0.0", inclusive = false) BigDecimal maxCreditedHoursPerRecord,
        @NotNull @Min(0) Integer sortOrder,
        Boolean active,
        Long version
) {
}
