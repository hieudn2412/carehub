package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record CreateBatchParaphraseJobsRequest(
        List<Long> questionIds,
        @Min(1) @Max(10) Integer requestedCount,
        @Pattern(regexp = "(?i)low|medium|high") String changeStrength
) {
}
