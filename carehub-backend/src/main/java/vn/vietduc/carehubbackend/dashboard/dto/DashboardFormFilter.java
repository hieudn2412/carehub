package vn.vietduc.carehubbackend.dashboard.dto;

import java.time.LocalDate;

public record DashboardFormFilter(
        LocalDate fromDate,
        LocalDate toDate,
        Long departmentId,
        Long formId,
        Long subjectUserId,
        Long submittedByUserId,
        DashboardFormResultFilter resultStatus
) {
    public boolean restrictToMatchedForms() {
        return departmentId != null
                || formId != null
                || subjectUserId != null
                || submittedByUserId != null
                || resultStatus != null;
    }
}
