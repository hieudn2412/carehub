package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

import java.time.Instant;
import java.util.List;

@Builder
public record FormAssignmentItemRowResponse(
        Long assignmentId,
        Long assignmentItemId,
        Long formId,
        String formCode,
        String formTitle,
        Long formVersionId,
        Integer versionNumber,
        Long assigneeId,
        String employeeCode,
        String fullName,
        Long departmentId,
        String departmentName,
        List<String> roleCodes,
        Instant assignedAt,
        Instant validFrom,
        Instant validUntil
) {
}
