package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.math.BigDecimal;
import java.util.UUID;

@Builder
public record FormOptionRequest(
        UUID optionKey,

        @NotBlank(message = "Option value is required")
        @Size(max = 255, message = "Option value must not exceed 255 characters")
        String value,

        @NotBlank(message = "Option label is required")
        @Size(max = 1000, message = "Option label must not exceed 1000 characters")
        String label,

        BigDecimal scoreValue,
        Boolean compliant,
        Boolean excludeFromDenominator,

        @NotNull(message = "Option display order is required")
        @Min(value = 0, message = "Option display order must not be negative")
        Integer displayOrder
) {
}
