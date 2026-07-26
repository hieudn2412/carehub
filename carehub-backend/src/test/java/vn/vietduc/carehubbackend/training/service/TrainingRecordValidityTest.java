package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class TrainingRecordValidityTest {
    private static final LocalDate AS_OF = LocalDate.of(2026, 7, 26);

    @Test
    void exactFiveYearBoundaryRemainsValidAndCountsWhenSubmitted() {
        LocalDate startDate = LocalDate.of(2021, 7, 26);

        assertThat(TrainingRecordValidity.validUntil(startDate, 5)).isEqualTo(AS_OF);
        assertThat(TrainingRecordValidity.isExpired(startDate, AS_OF, 5)).isFalse();
        assertThat(TrainingRecordValidity.countsTowardTotal(
                startDate, TrainingRecordStatus.SUBMITTED, AS_OF, 5
        )).isTrue();
    }

    @Test
    void recordOlderThanBoundaryIsExpiredAndDoesNotCount() {
        LocalDate startDate = LocalDate.of(2021, 7, 25);

        assertThat(TrainingRecordValidity.isExpired(startDate, AS_OF, 5)).isTrue();
        assertThat(TrainingRecordValidity.countsTowardTotal(
                startDate, TrainingRecordStatus.SUBMITTED, AS_OF, 5
        )).isFalse();
    }

    @Test
    void draftAndFutureRecordsDoNotCount() {
        assertThat(TrainingRecordValidity.countsTowardTotal(
                LocalDate.of(2026, 7, 1), TrainingRecordStatus.DRAFT, AS_OF, 5
        )).isFalse();
        assertThat(TrainingRecordValidity.countsTowardTotal(
                LocalDate.of(2026, 7, 27), TrainingRecordStatus.SUBMITTED, AS_OF, 5
        )).isFalse();
    }
}
