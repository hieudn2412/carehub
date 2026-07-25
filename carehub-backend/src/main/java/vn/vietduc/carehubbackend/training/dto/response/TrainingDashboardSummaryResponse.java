package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record TrainingDashboardSummaryResponse(
        LocalDate asOf,
        Long departmentId,
        Long professionalFieldId,
        ComplianceStatus complianceStatus,
        Totals totals,
        List<DepartmentItem> byDepartment
) {
    public record Totals(
            long employeeCount,
            long configuredCount,
            long notConfiguredCount,
            long compliantCount,
            long atRiskCount,
            long nonCompliantCount,
            BigDecimal requiredHours,
            BigDecimal submittedHours,
            BigDecimal remainingHours,
            BigDecimal averageProgressPercentage,
            BigDecimal complianceRate
    ) {}

    public record DepartmentItem(
            Long departmentId,
            String departmentName,
            long employeeCount,
            long configuredCount,
            long notConfiguredCount,
            long compliantCount,
            long atRiskCount,
            long nonCompliantCount,
            BigDecimal requiredHours,
            BigDecimal submittedHours,
            BigDecimal remainingHours,
            BigDecimal complianceRate
    ) {}
}
