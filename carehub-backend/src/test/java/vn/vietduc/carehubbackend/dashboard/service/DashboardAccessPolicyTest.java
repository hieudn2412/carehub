package vn.vietduc.carehubbackend.dashboard.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.vietduc.carehubbackend.auth.entity.UserPrincipal;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DashboardAccessPolicyTest {
    private final UserRepository userRepository = mock(UserRepository.class);
    private final DashboardAccessPolicy policy = new DashboardAccessPolicy(
            new SecurityUtils(),
            userRepository
    );

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void adminMayUseRequestedDepartmentOrHospitalScope() {
        authenticate(1L, "ROLE_ADMIN");

        assertThat(policy.resolveDepartmentScope(12L)).isEqualTo(12L);
        assertThat(policy.resolveDepartmentScope(null)).isNull();
    }

    @Test
    void managerIsAlwaysScopedToOwnDepartment() {
        authenticate(2L, "ROLE_MANAGER");
        when(userRepository.findByIdAndIsDeletedFalse(2L)).thenReturn(Optional.of(user(2L, 20L)));

        assertThat(policy.resolveDepartmentScope(null)).isEqualTo(20L);
        assertThat(policy.resolveDepartmentScope(20L)).isEqualTo(20L);
    }

    @Test
    void managerCannotRequestAnotherDepartment() {
        authenticate(2L, "ROLE_MANAGER");
        when(userRepository.findByIdAndIsDeletedFalse(2L)).thenReturn(Optional.of(user(2L, 20L)));

        assertThatThrownBy(() -> policy.resolveDepartmentScope(21L))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void userCannotOpenDepartmentDashboard() {
        authenticate(3L, "ROLE_USER");

        assertThatThrownBy(() -> policy.resolveDepartmentScope(null))
                .isInstanceOf(ForbiddenException.class);
    }

    private void authenticate(Long userId, String role) {
        UserPrincipal principal = mock(UserPrincipal.class);
        when(principal.getId()).thenReturn(userId);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        List.of(new SimpleGrantedAuthority(role))
                )
        );
    }

    private User user(Long id, Long departmentId) {
        return User.builder()
                .id(id)
                .employeeCode("VD" + id)
                .name("User " + id)
                .password("password")
                .department(Department.builder().id(departmentId).name("Department").build())
                .build();
    }
}
