package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TrainingRecordFormRequest(
        Long employeeId,
        @NotNull Long activityTypeId,
        Long professionalFieldId,
        String customProfessionalField,
        @NotBlank @Size(max = 500) String title,
        @Size(max = 255) String provider,
        String description,
        LocalDate startDate,
        LocalDate endDate,
        @DecimalMin("0.0") BigDecimal durationValue,
        @NotNull DurationUnit durationUnit,
        @Size(max = 100) String durationRawText,
        @DecimalMin(value = "0.5") BigDecimal declaredHours,
        Long version
) {
}
