package vn.vietduc.carehubbackend.form.submission.dto;

import java.math.BigDecimal;

public record FormHistoryTotalsResponse(
        long monitoringCount,
        long passedCount,
        long failedCount,
        BigDecimal complianceRate,
        BigDecimal averageConvertedScore
) {
}
