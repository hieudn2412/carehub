package vn.vietduc.carehubbackend.form.assignment.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpdateFormAssignmentDepartmentScopeRequest(
        @NotEmpty List<@NotNull Long> departmentIds
) {
}
