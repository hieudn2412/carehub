package vn.vietduc.carehubbackend.form.submission.dto;

public record FormHistorySummaryResponse(
        Long formId,
        String code,
        String title,
        long versionCount,
        long submissionCount
) {
}
