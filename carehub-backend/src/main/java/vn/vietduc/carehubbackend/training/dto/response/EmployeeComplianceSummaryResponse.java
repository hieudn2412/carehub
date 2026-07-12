package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;

import java.math.BigDecimal;

public record EmployeeComplianceSummaryResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        Long departmentId,
        String departmentName,
        Long positionId,
        String positionName,
        ComplianceStatus status,
        BigDecimal requiredHours,
        BigDecimal submittedHours,
        BigDecimal remainingHours
) {
}
