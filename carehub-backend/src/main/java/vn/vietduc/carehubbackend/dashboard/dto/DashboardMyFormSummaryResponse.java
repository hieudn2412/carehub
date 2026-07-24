package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Builder
public record DashboardMyFormSummaryResponse(
        OffsetDateTime generatedAt,
        Period period,
        long formCount,
        long submittedCount,
        long passedCount,
        long failedScoreCount,
        long failedCriticalCount,
        BigDecimal passRate,
        BigDecimal averageConvertedScore
) {
    public record Period(LocalDate fromDate, LocalDate toDate) {}
}
