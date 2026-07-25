package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

public record CreateParaphraseJobRequest(
        @Min(1) @Max(10) Integer requestedCount,
        @Pattern(regexp = "(?i)low|medium|high") String changeStrength
) {
}
