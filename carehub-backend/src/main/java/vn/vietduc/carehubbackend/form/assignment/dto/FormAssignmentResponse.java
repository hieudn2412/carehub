package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;

import java.time.Instant;
import java.util.List;

@Builder
public record FormAssignmentResponse(
        Long id,
        UserSummary manager,
        UserSummary assignedBy,
        Instant assignedAt,
        Instant validFrom,
        Instant validUntil,
        Instant revokedAt,
        FormAssignmentStatus status,
        List<ItemSummary> items
) {
    @Builder
    public record UserSummary(Long id, String employeeCode, String fullName) {}

    @Builder
    public record ItemSummary(
            Long assignmentItemId,
            Long formId,
            String formCode,
            String title,
            Long formVersionId,
            Integer versionNumber,
            FormAssignmentStatus status
    ) {}
}
