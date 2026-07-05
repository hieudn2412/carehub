package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Builder
public record DashboardOverviewResponse(
        OffsetDateTime generatedAt,
        int cacheTtlSeconds,
        Period period,
        Users users,
        Forms forms,
        Submissions submissions
) {
    @Builder
    public record Period(LocalDate fromDate, LocalDate toDate) {}

    @Builder
    public record Users(
            long total,
            long active,
            long inactive,
            long locked,
            long deleted,
            long firstLoginPending,
            long newInPeriod,
            long managers,
            long admins
    ) {}

    @Builder
    public record Forms(
            long total,
            long draft,
            long published,
            long retired,
            long publishedVersions,
            long activeAssignments
    ) {}

    @Builder
    public record Submissions(
            long totalInPeriod,
            long draft,
            long submitted,
            long voided,
            long passed,
            long failedScore,
            long failedCritical,
            BigDecimal passRate,
            BigDecimal averageConvertedScore
    ) {}
}
