package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TrainingRecordStateMachineTest {
    private final TrainingRecordStateMachine stateMachine = new TrainingRecordStateMachine();

    @Test
    void draftCanBeSubmitted() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT,
                TrainingRecordStatus.PENDING_REVIEW,
                false
        )).isTrue();
    }

    @Test
    void approvedCannotBeChangedByDefault() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.APPROVED,
                TrainingRecordStatus.PENDING_REVIEW,
                true
        )).isFalse();
    }

    @Test
    void pendingCancelRequiresAdmin() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.PENDING_REVIEW,
                TrainingRecordStatus.CANCELLED,
                false
        )).isFalse();

        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.PENDING_REVIEW,
                TrainingRecordStatus.CANCELLED,
                true
        )).isTrue();
    }

    @Test
    void invalidTransitionThrowsBadRequest() {
        assertThatThrownBy(() -> stateMachine.requireTransition(
                TrainingRecordStatus.DRAFT,
                TrainingRecordStatus.APPROVED,
                false
        )).isInstanceOf(BadRequestException.class);
    }
}
