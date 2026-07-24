package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Builder
public record ManagerDashboardOverviewResponse(
        OffsetDateTime generatedAt,
        Scope scope,
        Period period,
        Long professionalFieldId,
        Training training,
        Theory theory,
        Quality quality
) {
    public record Scope(
            Long departmentId,
            String departmentName
    ) {}

    public record Period(
            LocalDate fromDate,
            LocalDate toDate,
            boolean allTime
    ) {}

    @Builder
    public record Training(
            LocalDate asOf,
            long employeeCount,
            long configuredCount,
            long notConfiguredCount,
            long compliantCount,
            long atRiskCount,
            long nonCompliantCount,
            long needsAttentionCount,
            BigDecimal requiredHours,
            BigDecimal submittedHours,
            BigDecimal remainingHours,
            BigDecimal averageProgressPercentage,
            BigDecimal complianceRate,
            BigDecimal overallComplianceRate
    ) {}

    @Builder
    public record Theory(
            boolean available,
            long assignmentCount,
            long targetCount,
            long notStartedCount,
            long gradedAttempts,
            long passedAttempts,
            long failedAttempts,
            BigDecimal averageScore,
            BigDecimal passRate
    ) {}

    @Builder
    public record Quality(
            long submittedCount,
            long passedCount,
            long failedCount,
            long failedScoreCount,
            long failedCriticalCount,
            BigDecimal averageConvertedScore,
            BigDecimal passRate,
            boolean professionalFieldFilterApplied
    ) {}
}
