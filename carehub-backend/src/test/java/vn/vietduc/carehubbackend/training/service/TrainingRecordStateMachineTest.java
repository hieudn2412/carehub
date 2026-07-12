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
                TrainingRecordStatus.SUBMITTED,
                false
        )).isTrue();
    }

    @Test
    void draftCanBeCancelledByAnyone() {
        // Users can cancel their own DRAFT records
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT,
                TrainingRecordStatus.CANCELLED,
                false
        )).isTrue();

        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT,
                TrainingRecordStatus.CANCELLED,
                true
        )).isTrue();
    }

    @Test
    void submittedCanBeCancelledByAdminOnly() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED,
                TrainingRecordStatus.CANCELLED,
                false
        )).isFalse();

        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED,
                TrainingRecordStatus.CANCELLED,
                true
        )).isTrue();
    }

    @Test
    void submittedCannotBeChangedToDraft() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED,
                TrainingRecordStatus.DRAFT,
                false
        )).isFalse();
    }

    @Test
    void cancelledIsTerminal() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.CANCELLED,
                TrainingRecordStatus.DRAFT,
                true
        )).isFalse();
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.CANCELLED,
                TrainingRecordStatus.SUBMITTED,
                true
        )).isFalse();
    }

    @Test
    void invalidTransitionThrowsBadRequest() {
        assertThatThrownBy(() -> stateMachine.requireTransition(
                TrainingRecordStatus.CANCELLED,
                TrainingRecordStatus.DRAFT,
                true
        )).isInstanceOf(BadRequestException.class);

        assertThatThrownBy(() -> stateMachine.requireTransition(
                TrainingRecordStatus.SUBMITTED,
                TrainingRecordStatus.DRAFT,
                false
        )).isInstanceOf(BadRequestException.class);
    }

    @Test
    void draftSubmitRequiresNotCancelled() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT,
                TrainingRecordStatus.SUBMITTED,
                false
        )).isTrue();
    }
}
