package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * L1 unit tests — sheet {@code AccessPolicy &amp; EvaluationSecurity}, Test ID prefix {@code L1-SEC}
 * (IDs 01–14 live here, 15–26 in
 * {@code questiongeneration.security.EvaluationSecurityTest}).
 *
 * <p>Traces BR-29 (a manager may only act on employees in their own department), NAC-05-03 and
 * NAC-01-03. The emphasis is Condition Coverage: {@code canReadEmployee} guards on
 * {@code hasRole(MANAGER) && sameDepartment(...)} and {@code sameDepartment} itself is a
 * four-term conjunction, so each sub-condition is driven TRUE and FALSE independently.
 */
class TrainingAccessPolicyTest {
    private final TrainingAccessPolicy policy = new TrainingAccessPolicy(mock(UserRepository.class));

    // ── Block: canReadEmployee() — null guards ────────────────────────────────

    @Test
    @DisplayName("L1-SEC-01 | CC-TRUE: actor null → denied (first sub-condition)")
    void nullActorIsDenied() {
        assertThat(policy.canReadEmployee(null, Set.of(TrainingAccessPolicy.ROLE_ADMIN), user(2L, department(10L))))
                .isFalse();
    }

    @Test
    @DisplayName("L1-SEC-02 | CC-TRUE: target employee null → denied (second sub-condition)")
    void nullTargetEmployeeIsDenied() {
        assertThat(policy.canReadEmployee(user(1L, department(10L)), Set.of(TrainingAccessPolicy.ROLE_ADMIN), null))
                .isFalse();
    }

    @Test
    @DisplayName("L1-SEC-03 | EP-Invalid: null roleCodes collection → denied without NPE")
    void nullRoleCodesIsDenied() {
        assertThat(policy.canReadEmployee(user(1L, department(10L)), null, user(2L, department(20L))))
                .isFalse();
    }

    // ── Block: canReadEmployee() — role bypasses ──────────────────────────────

    @ParameterizedTest(name = "role={0}")
    @CsvSource({"ADMIN", "SYSTEM_JOB"})
    @DisplayName("L1-SEC-04 | EP-Valid: ADMIN and SYSTEM_JOB read any employee, any department")
    void privilegedRolesReadAnyEmployee(String role) {
        assertThat(policy.canReadEmployee(user(1L, department(10L)), Set.of(role), user(2L, department(20L))))
                .isTrue();
    }

    @Test
    @DisplayName("L1-SEC-05 | EP-Valid: an employee always reads their own record (self access)")
    void employeeReadsOwnRecord() {
        User actor = user(1L, department(10L));

        assertThat(policy.canReadEmployee(actor, Set.of("USER"), actor)).isTrue();
    }

    @Test
    @DisplayName("L1-SEC-06 | BC-FALSE: plain USER cannot read another employee in the same department")
    void userCannotReadAnotherEmployeeRecord() {
        User actor = user(1L, department(10L));
        TrainingRecord record = TrainingRecord.builder().employee(user(2L, department(10L))).build();

        assertThat(policy.canReadRecord(actor, Set.of("USER"), record)).isFalse();
    }

    // ── Block: canReadEmployee() — CC on hasRole(MANAGER) && sameDepartment ───

    @ParameterizedTest(name = "manager={0}, sameDepartment={1} → allowed={2}")
    @CsvSource({
            "true,  true,  true",   // both sub-conditions TRUE
            "true,  false, false",  // MANAGER TRUE, department FALSE
            "false, true,  false",  // MANAGER FALSE, department TRUE
            "false, false, false"   // both FALSE
    })
    @DisplayName("L1-SEC-07 | CC: full truth table of hasRole(MANAGER) && sameDepartment")
    void managerDepartmentGuardTruthTable(boolean isManager, boolean sameDepartment, boolean expected) {
        User actor = user(1L, department(10L));
        User target = user(2L, department(sameDepartment ? 10L : 20L));
        Set<String> roles = Set.of(isManager
                ? TrainingAccessPolicy.ROLE_MANAGER
                : "USER");

        assertThat(policy.canReadEmployee(actor, roles, target)).isEqualTo(expected);
    }

    // ── Block: sameDepartment() — the four-term conjunction ───────────────────

    @ParameterizedTest(name = "actorDept={0}, targetDept={1} → allowed={2}")
    @CsvSource({
            "10, 10, true",   // both present and equal
            "10, 20, false",  // both present, different ids
            "null, 10, false",// actor department null
            "10, null, false",// target department null
            "null, null, false"
    })
    @DisplayName("L1-SEC-08 | CC: sameDepartment requires both departments present and equal")
    void sameDepartmentSubConditions(String actorDepartmentId, String targetDepartmentId, boolean expected) {
        User actor = user(1L, departmentOrNull(actorDepartmentId));
        User target = user(2L, departmentOrNull(targetDepartmentId));

        assertThat(policy.canReadEmployee(actor, Set.of(TrainingAccessPolicy.ROLE_MANAGER), target))
                .isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-SEC-09 | CC-TRUE: department present but its id is null → denied")
    void departmentWithNullIdIsDenied() {
        User actor = user(1L, Department.builder().name("No id").build());
        User target = user(2L, Department.builder().name("No id").build());

        assertThat(policy.canReadEmployee(actor, Set.of(TrainingAccessPolicy.ROLE_MANAGER), target)).isFalse();
    }

    // ── Block: canReadRecord() — record null guards ───────────────────────────

    @Test
    @DisplayName("L1-SEC-10 | CC-TRUE: null record → denied (first sub-condition)")
    void nullRecordIsDenied() {
        assertThat(policy.canReadRecord(user(1L, department(10L)), Set.of(TrainingAccessPolicy.ROLE_ADMIN), null))
                .isFalse();
    }

    @Test
    @DisplayName("L1-SEC-11 | CC-TRUE: record without an employee → denied even for ADMIN")
    void recordWithoutEmployeeIsDenied() {
        TrainingRecord record = TrainingRecord.builder().build();

        assertThat(policy.canReadRecord(user(1L, department(10L)), Set.of(TrainingAccessPolicy.ROLE_ADMIN), record))
                .isFalse();
    }

    // ── Block: canCreateRecordFor() ───────────────────────────────────────────

    @ParameterizedTest(name = "role={0}, sameDepartment={1}, self={2} → allowed={3}")
    @CsvSource({
            "ADMIN,      false, false, true",   // admin bypass
            "SYSTEM_JOB, false, false, true",   // system job bypass
            "MANAGER,    true,  false, true",   // manager inside own department
            "MANAGER,    false, false, false",  // manager outside own department
            "USER,       true,  true,  true",   // self
            "USER,       true,  false, false"   // other employee, same department
    })
    @DisplayName("L1-SEC-12 | CC: canCreateRecordFor combines role bypass, department scope and self access")
    void createRecordPermissionMatrix(String role, boolean sameDepartment, boolean self, boolean expected) {
        User actor = user(1L, department(10L));
        User target = self ? actor : user(2L, department(sameDepartment ? 10L : 20L));

        assertThat(policy.canCreateRecordFor(actor, Set.of(role), target)).isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-SEC-13 | Negative: requireCanReadEmployee / requireCanReadRecord throw ForbiddenException")
    void requireMethodsThrowForbidden() {
        User actor = user(1L, department(10L));
        User target = user(2L, department(20L));
        TrainingRecord record = TrainingRecord.builder().employee(target).build();
        Set<String> roles = Set.of("USER");

        assertThatThrownBy(() -> policy.requireCanReadEmployee(actor, roles, target))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("do not have access");
        assertThatThrownBy(() -> policy.requireCanReadRecord(actor, roles, record))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("training record");
        assertThatCode(() -> policy.requireCanReadEmployee(actor, Set.of(TrainingAccessPolicy.ROLE_ADMIN), target))
                .doesNotThrowAnyException();
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private User user(Long id, Department department) {
        return User.builder()
                .id(id)
                .employeeCode("VD" + id)
                .name("User " + id)
                .password("password")
                .department(department)
                .build();
    }

    private Department department(Long id) {
        return Department.builder().id(id).name("Department " + id).build();
    }

    private Department departmentOrNull(String id) {
        return "null".equals(id) ? null : department(Long.valueOf(id));
    }
}
