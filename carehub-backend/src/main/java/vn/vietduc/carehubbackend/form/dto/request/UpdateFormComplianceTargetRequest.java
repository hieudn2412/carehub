package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;

public record UpdateFormComplianceTargetRequest(
        @DecimalMin(value = "0.0", message = "Mục tiêu phải từ 0 đến 100")
        @DecimalMax(value = "100.0", message = "Mục tiêu phải từ 0 đến 100")
        BigDecimal targetPercent
) {
}
