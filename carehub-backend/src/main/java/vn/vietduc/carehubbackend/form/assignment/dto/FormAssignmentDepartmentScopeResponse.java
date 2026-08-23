package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

@Builder
public record FormAssignmentDepartmentScopeResponse(
        Long departmentId,
        String departmentName
) {
}
