package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class TrainingAccessPolicyTest {
    private final TrainingAccessPolicy policy = new TrainingAccessPolicy(mock(UserRepository.class));

    @Test
    void userCannotReadAnotherEmployeeRecord() {
        User actor = user(1L, department(10L));
        User otherEmployee = user(2L, department(10L));
        TrainingRecord record = TrainingRecord.builder().employee(otherEmployee).build();

        boolean allowed = policy.canReadRecord(actor, Set.of(TrainingAccessPolicy.ROLE_USER), record);

        assertThat(allowed).isFalse();
    }

    @Test
    void managerCannotReadEmployeeOutsideDepartment() {
        User manager = user(1L, department(10L));
        User outsideEmployee = user(2L, department(20L));

        boolean allowed = policy.canReadEmployee(manager, Set.of(TrainingAccessPolicy.ROLE_MANAGER), outsideEmployee);

        assertThat(allowed).isFalse();
    }

    @Test
    void managerCanReadEmployeeInsideDepartment() {
        Department department = department(10L);
        User manager = user(1L, department);
        User employee = user(2L, department);

        boolean allowed = policy.canReadEmployee(manager, Set.of(TrainingAccessPolicy.ROLE_MANAGER), employee);

        assertThat(allowed).isTrue();
    }

    @Test
    void adminCanReadAnyEmployee() {
        User admin = user(1L, department(10L));
        User employee = user(2L, department(20L));

        boolean allowed = policy.canReadEmployee(admin, Set.of(TrainingAccessPolicy.ROLE_ADMIN), employee);

        assertThat(allowed).isTrue();
    }

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
        return Department.builder()
                .id(id)
                .name("Department " + id)
                .build();
    }
}
