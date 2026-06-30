package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateParaphraseJobRequest(
        @Min(1) @Max(10) Integer requestedCount,
        String changeStrength
) {
}
