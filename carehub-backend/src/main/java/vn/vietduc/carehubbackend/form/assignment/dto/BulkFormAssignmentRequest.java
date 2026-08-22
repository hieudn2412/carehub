package vn.vietduc.carehubbackend.form.assignment.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record BulkFormAssignmentRequest(
        @NotEmpty @Size(max = 25) List<@NotNull Long> formIds,
        @NotEmpty @Size(max = 100) List<@NotNull Long> assigneeIds,
        @Future Instant validUntil
) {
}
