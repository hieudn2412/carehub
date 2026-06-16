package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;

public record ActivityTypeFormRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        String description,
        @NotNull DurationUnit defaultDurationUnit,
        boolean requiresEvidence,
        @DecimalMin("0.0") BigDecimal maxCreditedHoursPerRecord,
        Integer sortOrder,
        Boolean active,
        Long version
) {
}
