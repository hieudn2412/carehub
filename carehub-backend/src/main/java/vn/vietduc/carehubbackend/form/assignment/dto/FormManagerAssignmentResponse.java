package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;

import java.time.Instant;

@Builder
public record FormManagerAssignmentResponse(
        Long assignmentId,
        Long assignmentItemId,
        UserSummary manager,
        UserSummary assignedBy,
        Instant assignedAt,
        Instant validFrom,
        Instant validUntil,
        Instant revokedAt,
        FormAssignmentStatus assignmentStatus,
        FormAssignmentStatus effectiveStatus,
        FormAssignmentStatus itemStatus,
        Long formVersionId,
        Integer versionNumber,
        String title
) {
    @Builder
    public record UserSummary(Long id, String employeeCode, String fullName) {}
}
