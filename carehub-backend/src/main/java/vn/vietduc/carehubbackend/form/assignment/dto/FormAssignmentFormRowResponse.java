package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

import java.time.Instant;

@Builder
public record FormAssignmentFormRowResponse(
        Long formId,
        String formCode,
        String formTitle,
        Long formVersionId,
        Integer versionNumber,
        Long ownerDepartmentId,
        String ownerDepartmentName,
        long recipientCount,
        Instant nearestExpiry
) {
}
