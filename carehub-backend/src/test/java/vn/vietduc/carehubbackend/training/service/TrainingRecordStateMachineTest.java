package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * L1 unit tests — sheet {@code TrainingRecordStateMachine}, Test ID prefix {@code L1-TRSM}.
 * Pure domain logic: no mocks needed.
 *
 * <p>Transition table under test ({@code canTransition}):
 * <pre>
 *   DRAFT     -> SUBMITTED  : allowed, any actor
 *   DRAFT     -> CANCELLED  : allowed, any actor
 *   SUBMITTED -> DRAFT      : allowed; ownership is enforced by the application service
 *   SUBMITTED -> CANCELLED  : allowed only when adminActor == true
 *   CANCELLED -> *          : rejected (terminal)
 *   from == to / null       : rejected
 * </pre>
 *
 * <p>The {@code adminActor} guard only protects cancellation of a submitted record.
 * Returning to draft is allowed by the state machine after the application service has
 * confirmed that the actor is either the record owner or an administrator.
 */
class TrainingRecordStateMachineTest {
    private final TrainingRecordStateMachine stateMachine = new TrainingRecordStateMachine();

    // ── Block: canTransition() — valid transitions out of DRAFT ───────────────

    @Test
    @DisplayName("L1-TRSM-01 | State-Valid: DRAFT + submit by owner → allowed")
    void draftCanBeSubmittedByOwner() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT, TrainingRecordStatus.SUBMITTED, false
        )).isTrue();
    }

    @Test
    @DisplayName("L1-TRSM-02 | CC: DRAFT + submit by admin → allowed (adminActor is not a guard here)")
    void draftCanBeSubmittedByAdmin() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT, TrainingRecordStatus.SUBMITTED, true
        )).isTrue();
    }

    @ParameterizedTest(name = "adminActor={0}")
    @CsvSource({"false", "true"})
    @DisplayName("L1-TRSM-03 | CC: DRAFT + cancel → allowed for both actor kinds")
    void draftCanBeCancelledByAnyone(boolean adminActor) {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.DRAFT, TrainingRecordStatus.CANCELLED, adminActor
        )).isTrue();
    }

    // ── Block: canTransition() — the adminActor guard out of SUBMITTED ─────────

    @Test
    @DisplayName("L1-TRSM-04 | Owner flow: SUBMITTED + return-to-draft → allowed")
    void submittedCanBeReturnedToDraftByOwner() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED, TrainingRecordStatus.DRAFT, false
        )).isTrue();
    }

    @Test
    @DisplayName("L1-TRSM-05 | Guard-TRUE: SUBMITTED + return-to-draft by admin → allowed")
    void submittedCanBeReturnedToDraftByAdmin() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED, TrainingRecordStatus.DRAFT, true
        )).isTrue();
    }

    @Test
    @DisplayName("L1-TRSM-06 | Guard-TRUE: SUBMITTED + cancel, adminActor=TRUE → allowed")
    void submittedCanBeCancelledByAdmin() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED, TrainingRecordStatus.CANCELLED, true
        )).isTrue();
    }

    @Test
    @DisplayName("L1-TRSM-07 | Guard-FALSE: SUBMITTED + cancel, adminActor=FALSE → rejected")
    void submittedCannotBeCancelledByNonAdmin() {
        assertThat(stateMachine.canTransition(
                TrainingRecordStatus.SUBMITTED, TrainingRecordStatus.CANCELLED, false
        )).isFalse();
    }

    @ParameterizedTest(name = "SUBMITTED -> {0}, adminActor={1} → {2}")
    @CsvSource({
            "DRAFT,     false, true",
            "DRAFT,     true,  true",
            "CANCELLED, false, false",
            "CANCELLED, true,  true"
    })
    @DisplayName("L1-TRSM-17 | CC: full truth table of adminActor × target for transitions out of SUBMITTED")
    void submittedGuardTruthTable(TrainingRecordStatus target, boolean adminActor, boolean expected) {
        assertThat(stateMachine.canTransition(TrainingRecordStatus.SUBMITTED, target, adminActor))
                .isEqualTo(expected);
    }

    // ── Block: canTransition() — invalid transitions ──────────────────────────

    @ParameterizedTest(name = "CANCELLED -> {0}")
    @EnumSource(TrainingRecordStatus.class)
    @DisplayName("L1-TRSM-08 | State-Invalid: CANCELLED is terminal → every target rejected, even for admin")
    void cancelledIsTerminalForEveryTarget(TrainingRecordStatus target) {
        assertThat(stateMachine.canTransition(TrainingRecordStatus.CANCELLED, target, true)).isFalse();
        assertThat(stateMachine.canTransition(TrainingRecordStatus.CANCELLED, target, false)).isFalse();
    }

    @ParameterizedTest(name = "{0} -> {0}")
    @EnumSource(TrainingRecordStatus.class)
    @DisplayName("L1-TRSM-09 | State-Invalid: self-transition from == to → rejected")
    void selfTransitionIsRejected(TrainingRecordStatus status) {
        assertThat(stateMachine.canTransition(status, status, true)).isFalse();
        assertThat(stateMachine.canTransition(status, status, false)).isFalse();
    }

    @Test
    @DisplayName("L1-TRSM-10 | EP-Invalid: source status null → rejected without NPE")
    void nullSourceStatusIsRejected() {
        assertThat(stateMachine.canTransition(null, TrainingRecordStatus.SUBMITTED, true)).isFalse();
    }

    @Test
    @DisplayName("L1-TRSM-11 | EP-Invalid: target status null → rejected without NPE")
    void nullTargetStatusIsRejected() {
        assertThat(stateMachine.canTransition(TrainingRecordStatus.DRAFT, null, true)).isFalse();
    }

    // ── Block: requireTransition() — exception path ───────────────────────────

    @Test
    @DisplayName("L1-TRSM-12 | Guard-FALSE: requireTransition SUBMITTED→CANCELLED as non-admin throws")
    void requireTransitionThrowsWhenAdminGuardFails() {
        assertThatThrownBy(() -> stateMachine.requireTransition(
                TrainingRecordStatus.SUBMITTED, TrainingRecordStatus.CANCELLED, false
        ))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("SUBMITTED")
                .hasMessageContaining("CANCELLED");
    }

    @Test
    @DisplayName("L1-TRSM-18 | Owner flow: requireTransition SUBMITTED→DRAFT succeeds")
    void requireTransitionAllowsOwnerReturnToDraft() {
        assertThatCode(() -> stateMachine.requireTransition(
                TrainingRecordStatus.SUBMITTED, TrainingRecordStatus.DRAFT, false
        ))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-TRSM-13 | State-Invalid: requireTransition from CANCELLED throws naming both states")
    void requireTransitionThrowsFromTerminalState() {
        assertThatThrownBy(() -> stateMachine.requireTransition(
                TrainingRecordStatus.CANCELLED, TrainingRecordStatus.DRAFT, true
        ))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Không thể chuyển trạng thái hồ sơ đào tạo")
                .hasMessageContaining("CANCELLED")
                .hasMessageContaining("DRAFT");
    }

    @Test
    @DisplayName("L1-TRSM-14 | State-Valid: requireTransition on an allowed transition does not throw")
    void requireTransitionPassesForAllowedTransition() {
        assertThatCode(() -> stateMachine.requireTransition(
                TrainingRecordStatus.DRAFT, TrainingRecordStatus.SUBMITTED, false
        )).doesNotThrowAnyException();
    }

    // ── Block: isEditable() / requireEditable() ───────────────────────────────

    @ParameterizedTest(name = "{0} → editable={1}")
    @CsvSource({
            "DRAFT, true",
            "SUBMITTED, false",
            "CANCELLED, false"
    })
    @DisplayName("L1-TRSM-15 | BC-TRUE/BC-FALSE: only DRAFT records are editable")
    void onlyDraftIsEditable(TrainingRecordStatus status, boolean expected) {
        assertThat(stateMachine.isEditable(status)).isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-TRSM-16 | BC-FALSE: requireEditable on a SUBMITTED record throws naming the status")
    void requireEditableThrowsForSubmittedRecord() {
        assertThatThrownBy(() -> stateMachine.requireEditable(TrainingRecordStatus.SUBMITTED))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("SUBMITTED")
                .hasMessageContaining("không thể chỉnh sửa");
    }
}
