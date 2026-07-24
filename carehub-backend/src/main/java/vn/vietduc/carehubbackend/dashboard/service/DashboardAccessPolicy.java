package vn.vietduc.carehubbackend.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class DashboardAccessPolicy {
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_MANAGER = "MANAGER";

    private final SecurityUtils securityUtils;
    private final UserRepository userRepository;

    public Long resolveDepartmentScope(Long requestedDepartmentId) {
        Set<String> roles = currentRoleCodes();
        if (roles.contains(ROLE_ADMIN)) {
            return requestedDepartmentId;
        }
        if (!roles.contains(ROLE_MANAGER)) {
            throw new ForbiddenException("You do not have access to this dashboard");
        }

        User actor = userRepository.findByIdAndIsDeletedFalse(securityUtils.getCurrentUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng hiện tại"));
        Department department = actor.getDepartment();
        if (department == null || department.getId() == null) {
            throw new ForbiddenException("Manager account is not assigned to a department");
        }
        Long managerDepartmentId = department.getId();
        if (requestedDepartmentId != null && !managerDepartmentId.equals(requestedDepartmentId)) {
            throw new ForbiddenException("Manager can only view dashboard data from their department");
        }
        return managerDepartmentId;
    }

    private Set<String> currentRoleCodes() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ForbiddenException("Missing authenticated user");
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(value -> value != null && value.startsWith("ROLE_")
                        ? value.substring("ROLE_".length())
                        : value)
                .collect(Collectors.toSet());
    }
}
