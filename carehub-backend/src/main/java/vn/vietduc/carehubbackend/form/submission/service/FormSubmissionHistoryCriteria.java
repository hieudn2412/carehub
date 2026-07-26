package vn.vietduc.carehubbackend.form.submission.service;

import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;

public record FormSubmissionHistoryCriteria(
        String keyword,
        Long submittedByUserId,
        Long departmentId,
        boolean filterResults,
        List<FormSubmissionResult> results,
        Instant fromInclusive,
        Instant toExclusive
) {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Bangkok");
    private static final Instant UNBOUNDED_FROM = LocalDate.of(1900, 1, 1)
            .atStartOfDay(BUSINESS_ZONE)
            .toInstant();
    private static final Instant UNBOUNDED_TO = LocalDate.of(9999, 12, 31)
            .plusDays(1)
            .atStartOfDay(BUSINESS_ZONE)
            .toInstant();
    private static final List<FormSubmissionResult> ALL_RESULTS = List.of(
            FormSubmissionResult.PASSED,
            FormSubmissionResult.FAILED_SCORE,
            FormSubmissionResult.FAILED_CRITICAL
    );

    public static FormSubmissionHistoryCriteria of(
            String keyword,
            Long submittedByUserId,
            Long departmentId,
            String result,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            throw ValidationException.field("dateTo", "Ngày kết thúc phải từ ngày bắt đầu trở đi");
        }

        String normalizedKeyword = keyword == null || keyword.isBlank()
                ? null
                : "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
        String normalizedResult = result == null ? "" : result.trim().toUpperCase(Locale.ROOT);
        List<FormSubmissionResult> results = switch (normalizedResult) {
            case "" -> ALL_RESULTS;
            case "PASSED" -> List.of(FormSubmissionResult.PASSED);
            case "FAILED" -> List.of(FormSubmissionResult.FAILED_SCORE, FormSubmissionResult.FAILED_CRITICAL);
            case "FAILED_SCORE" -> List.of(FormSubmissionResult.FAILED_SCORE);
            case "FAILED_CRITICAL" -> List.of(FormSubmissionResult.FAILED_CRITICAL);
            default -> throw ValidationException.field("result", "Kết quả lọc không hợp lệ");
        };

        return new FormSubmissionHistoryCriteria(
                normalizedKeyword,
                submittedByUserId,
                departmentId,
                !normalizedResult.isEmpty(),
                results,
                dateFrom == null ? UNBOUNDED_FROM : dateFrom.atStartOfDay(BUSINESS_ZONE).toInstant(),
                dateTo == null ? UNBOUNDED_TO : dateTo.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant()
        );
    }
}
