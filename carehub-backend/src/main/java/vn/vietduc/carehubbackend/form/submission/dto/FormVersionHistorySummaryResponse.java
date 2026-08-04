package vn.vietduc.carehubbackend.form.submission.dto;

import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record FormVersionHistorySummaryResponse(
        Long formId,
        Long versionId,
        Integer versionNumber,
        String title,
        String description,
        FormVersionStatus status,
        Instant publishedAt,
        String publishedBy,
        long total,
        long passed,
        long failed,
        BigDecimal averageConvertedScore,
        BigDecimal complianceRate,
        Instant lastSubmittedAt
) {
}
