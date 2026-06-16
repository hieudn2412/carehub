package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PersonalTrainingStatusResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        ComplianceStatus status,
        BigDecimal requiredHours,
        BigDecimal approvedHours,
        BigDecimal remainingHours,
        LocalDate windowStart,
        LocalDate windowEnd,
        Long requirementId,
        String requirementName
) {
}
