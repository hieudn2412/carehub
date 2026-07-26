package vn.vietduc.carehubbackend.form.submission.dto;

import java.math.BigDecimal;

public record FormSubmissionSummaryResponse(
        long total,
        long passed,
        long failed,
        BigDecimal averageConvertedScore
) {}
