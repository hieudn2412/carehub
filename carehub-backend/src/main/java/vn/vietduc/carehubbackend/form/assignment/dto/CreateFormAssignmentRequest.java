package vn.vietduc.carehubbackend.form.assignment.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record CreateFormAssignmentRequest(
        @NotNull Long managerId,
        Instant validFrom,
        @Future Instant validUntil,
        @NotEmpty @Size(max = 25) List<@NotNull Long> formVersionIds
) {
}
