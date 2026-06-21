package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeTrainingStatusSummaryResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        Long departmentId,
        String departmentName,
        Long jobPositionId,
        String jobPositionName,
        Long requirementId,
        String requirementName,
        BigDecimal requiredHours,
        BigDecimal approvedHours,
        BigDecimal pendingHours,
        BigDecimal rejectedHours,
        BigDecimal remainingHours,
        BigDecimal progressPercentage,
        Integer cycleYears,
        LocalDate windowStart,
        LocalDate windowEnd,
        ComplianceStatus complianceStatus,
        LocalDate lastTrainingDate,
        long pendingReviewCount,
        String warningMessage
) {
}
