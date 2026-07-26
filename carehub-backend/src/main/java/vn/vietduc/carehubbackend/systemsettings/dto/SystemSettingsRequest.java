package vn.vietduc.carehubbackend.systemsettings.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SystemSettingsRequest(
        @NotNull
        @DecimalMin(value = "0.5", message = "Global training hours must be at least 0.5")
        BigDecimal globalTrainingHours,
        Long version
) {
}
