package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Builder
public record DashboardFormSummaryResponse(
        OffsetDateTime generatedAt,
        int cacheTtlSeconds,
        Forms forms,
        Versions versions,
        Assignments assignments,
        Responses responses
) {
    @Builder
    public record Forms(long total, long draft, long published, long retired) {}

    @Builder
    public record Versions(long draft, long published, long retired) {}

    @Builder
    public record Assignments(long activeItems, long expiredItems, long revokedItems) {}

    @Builder
    public record Responses(
            long totalInPeriod,
            long submitted,
            long draft,
            long voided,
            BigDecimal passRate,
            BigDecimal averageConvertedScore
    ) {}
}
