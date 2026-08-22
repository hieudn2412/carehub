package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

import java.time.Instant;
import java.util.List;

@Builder
public record FormAssignmentAssigneeRowResponse(
        Long assigneeId,
        String employeeCode,
        String fullName,
        Long departmentId,
        String departmentName,
        List<String> roleCodes,
        long formCount,
        Instant nearestExpiry
) {
}
