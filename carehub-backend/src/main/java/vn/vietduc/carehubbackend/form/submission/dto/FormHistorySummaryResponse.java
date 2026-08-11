package vn.vietduc.carehubbackend.form.submission.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record FormHistorySummaryResponse(
        Long formId,
        String code,
        String title,
        long versionCount,
        long submissionCount,
        long monitoringCount,
        long passedCount,
        long failedCount,
        BigDecimal complianceRate,
        Instant lastSubmittedAt,
        BigDecimal targetPercent,
        String targetSource
) {
}
