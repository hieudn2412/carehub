package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public record UpdateFormScoringConfigurationRequest(
        @Min(value = 0, message = "Critical weight percentage must be at least 0")
        @Max(value = 100, message = "Critical weight percentage must not exceed 100")
        Integer criticalWeightPercent,

        @Valid
        PassingScoreConfigurationRequest passingScore,

        @NotNull(message = "Lock version is required")
        @Min(value = 0, message = "Lock version must not be negative")
        Long lockVersion
) {}
