package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;

@Builder
public record DashboardFormPerformanceResponse(
        Long formId,
        String formCode,
        String formTitle,
        Long currentPublishedVersionId,
        Integer currentVersionNumber,
        long responseCount,
        long submittedCount,
        long passedCount,
        long failedScoreCount,
        long failedCriticalCount,
        BigDecimal passRate,
        BigDecimal averageConvertedScore,
        Instant lastSubmittedAt
) {}
