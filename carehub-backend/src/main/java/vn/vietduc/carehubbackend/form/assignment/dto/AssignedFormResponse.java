package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.List;

@Builder
public record AssignedFormResponse(
        Long assignmentItemId,
        Long formId,
        String formCode,
        String title,
        BigDecimal complianceTargetPercent,
        String complianceTargetSource,
        Instant validFrom,
        Instant validUntil,
        FormVersionResponse version,
        Boolean allDepartments,
        List<FormAssignmentDepartmentScopeResponse> allowedDepartments
) {
}
