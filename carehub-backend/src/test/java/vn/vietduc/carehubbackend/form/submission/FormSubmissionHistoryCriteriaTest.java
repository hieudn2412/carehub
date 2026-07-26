package vn.vietduc.carehubbackend.form.submission;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;
import vn.vietduc.carehubbackend.form.submission.service.FormSubmissionHistoryCriteria;

import java.time.LocalDate;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FormSubmissionHistoryCriteriaTest {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Bangkok");

    @Test
    void buildsInclusiveBusinessDateRangeAndCombinedFailedFilter() {
        var criteria = FormSubmissionHistoryCriteria.of(
                "  Nguyen Van A  ",
                7L,
                9L,
                "FAILED",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 26)
        );

        assertThat(criteria.keyword()).isEqualTo("%nguyen van a%");
        assertThat(criteria.filterResults()).isTrue();
        assertThat(criteria.results()).containsExactly(
                FormSubmissionResult.FAILED_SCORE,
                FormSubmissionResult.FAILED_CRITICAL
        );
        assertThat(criteria.fromInclusive()).isEqualTo(
                LocalDate.of(2026, 7, 1).atStartOfDay(BUSINESS_ZONE).toInstant());
        assertThat(criteria.toExclusive()).isEqualTo(
                LocalDate.of(2026, 7, 27).atStartOfDay(BUSINESS_ZONE).toInstant());
    }

    @Test
    void leavesResultUnfilteredWhenResultIsBlank() {
        var criteria = FormSubmissionHistoryCriteria.of(null, null, null, null, null, null);

        assertThat(criteria.filterResults()).isFalse();
        assertThat(criteria.results()).containsExactly(
                FormSubmissionResult.PASSED,
                FormSubmissionResult.FAILED_SCORE,
                FormSubmissionResult.FAILED_CRITICAL
        );
        assertThat(criteria.fromInclusive()).isNotNull();
        assertThat(criteria.toExclusive()).isNotNull();
        assertThat(criteria.fromInclusive()).isBefore(criteria.toExclusive());
    }

    @Test
    void rejectsReversedDateRange() {
        assertThatThrownBy(() -> FormSubmissionHistoryCriteria.of(
                null,
                null,
                null,
                null,
                LocalDate.of(2026, 7, 27),
                LocalDate.of(2026, 7, 26)
        )).isInstanceOf(ValidationException.class);
    }
}
