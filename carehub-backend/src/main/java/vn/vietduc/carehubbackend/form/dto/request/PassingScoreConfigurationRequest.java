package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import vn.vietduc.carehubbackend.form.scoring.PassingScoreMode;

import java.math.BigDecimal;

public record PassingScoreConfigurationRequest(
        @NotNull(message = "Passing score mode is required") PassingScoreMode mode,
        BigDecimal value
) {
    @AssertTrue(message = "Custom passing score must be between 0 and 10 with at most one decimal place")
    public boolean isValid() {
        if (mode == null) return true;
        if (mode == PassingScoreMode.DEFAULT) return value == null;
        return value != null
                && value.compareTo(BigDecimal.ZERO) >= 0
                && value.compareTo(BigDecimal.TEN) <= 0
                && Math.max(value.stripTrailingZeros().scale(), 0) <= 1;
    }
}
