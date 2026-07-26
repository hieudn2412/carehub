package vn.vietduc.carehubbackend.form.assignment.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record CreateFormAssignmentRequest(
        Long managerId,
        @Size(max = 100) List<@NotNull Long> assigneeIds,
        Instant validFrom,
        @Future Instant validUntil,
        @NotEmpty @Size(max = 25) List<@NotNull Long> formVersionIds
) {
    public CreateFormAssignmentRequest(Long managerId, Instant validFrom, Instant validUntil,
                                       List<Long> formVersionIds) {
        this(managerId, null, validFrom, validUntil, formVersionIds);
    }

    public List<Long> effectiveAssigneeIds() {
        if (assigneeIds != null && !assigneeIds.isEmpty()) return assigneeIds;
        return managerId == null ? List.of() : List.of(managerId);
    }
}
