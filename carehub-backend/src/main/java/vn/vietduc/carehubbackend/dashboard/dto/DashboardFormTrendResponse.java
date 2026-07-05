package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.util.List;

@Builder
public record DashboardFormTrendResponse(
        DashboardTrendBucket bucket,
        List<Item> items
) {
    @Builder
    public record Item(
            String period,
            long submittedCount,
            long passedCount,
            long failedCount,
            BigDecimal averageConvertedScore
    ) {}
}
