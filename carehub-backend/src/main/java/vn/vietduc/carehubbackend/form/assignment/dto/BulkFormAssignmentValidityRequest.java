package vn.vietduc.carehubbackend.form.assignment.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record BulkFormAssignmentValidityRequest(
        @NotEmpty @Size(max = 2500) List<@NotNull Long> assignmentItemIds,
        @Future Instant validUntil
) {
}
