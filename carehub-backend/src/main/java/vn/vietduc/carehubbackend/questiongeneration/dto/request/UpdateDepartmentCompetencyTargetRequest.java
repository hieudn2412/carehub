package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record UpdateDepartmentCompetencyTargetRequest(
        @NotNull
        @DecimalMin(value = "0.0")
        @DecimalMax(value = "100.0")
        @Digits(integer = 3, fraction = 2)
        BigDecimal targetScore
) {
}
