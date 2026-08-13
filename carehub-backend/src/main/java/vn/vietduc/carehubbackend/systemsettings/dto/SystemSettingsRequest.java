package vn.vietduc.carehubbackend.systemsettings.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SystemSettingsRequest(
        @NotNull
        @DecimalMin(value = "0.5", message = "Global training hours must be at least 0.5")
        BigDecimal globalTrainingHours,
        @Min(value = 1, message = "Training window must be at least 1 year")
        @Max(value = 100, message = "Training window must not exceed 100 years")
        Integer trainingWindowYears,
        Long version
) {
}
