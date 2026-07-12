package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.auth.entity.UserPrincipal;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class TrainingAccessPolicy {
    public static final String ROLE_ADMIN = "ADMIN";
    public static final String ROLE_MANAGER = "MANAGER";
    public static final String ROLE_USER = "USER";
    public static final String ROLE_SYSTEM_JOB = "SYSTEM_JOB";

    private final UserRepository userRepository;

    public boolean canReadRecord(User actor, Collection<String> roleCodes, TrainingRecord record) {
        if (record == null || record.getEmployee() == null) {
            return false;
        }
        return canReadEmployee(actor, roleCodes, record.getEmployee());
    }

    public boolean canReadEmployee(User actor, Collection<String> roleCodes, User targetEmployee) {
        if (actor == null || targetEmployee == null) {
            return false;
        }
        if (hasAnyRole(roleCodes, ROLE_ADMIN, ROLE_SYSTEM_JOB)) {
            return true;
        }
        if (actor.getId() != null && actor.getId().equals(targetEmployee.getId())) {
            return true;
        }
        return hasRole(roleCodes, ROLE_MANAGER) && sameDepartment(actor, targetEmployee);
    }

    public boolean canCreateRecordFor(User actor, Collection<String> roleCodes, User targetEmployee) {
        if (actor == null || targetEmployee == null) {
            return false;
        }
        if (hasAnyRole(roleCodes, ROLE_ADMIN, ROLE_SYSTEM_JOB)) {
            return true;
        }
        if (hasRole(roleCodes, ROLE_MANAGER) && sameDepartment(actor, targetEmployee)) {
            return true;
        }
        return actor.getId() != null && actor.getId().equals(targetEmployee.getId());
    }

    public void requireCanReadRecord(User actor, Collection<String> roleCodes, TrainingRecord record) {
        if (!canReadRecord(actor, roleCodes, record)) {
            throw new ForbiddenException("You do not have access to this training record");
        }
    }

    public void requireCanReadEmployee(User actor, Collection<String> roleCodes, User targetEmployee) {
        if (!canReadEmployee(actor, roleCodes, targetEmployee)) {
            throw new ForbiddenException("You do not have access to this employee training status");
        }
    }

    public User currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ForbiddenException("Missing authenticated user");
        }
        Object principal = authentication.getPrincipal();
        Long userId;
        if (!(principal instanceof UserPrincipal userPrincipal)) {
            if (principal instanceof Jwt jwt) {
                userId = Long.valueOf(jwt.getSubject());
            } else if (authentication.getName() != null && authentication.getName().matches("\\d+")) {
                userId = Long.valueOf(authentication.getName());
            } else {
                throw new ForbiddenException("Missing authenticated user");
            }
        } else {
            userId = userPrincipal.getId();
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Current user not found"));
    }

    public Set<String> currentRoleCodes() {
        return SecurityContextHolder.getContext()
                .getAuthentication()
                .getAuthorities()
                .stream()
                .map(TrainingAccessPolicy::roleCodeOf)
                .collect(Collectors.toSet());
    }

    public static Set<String> roleCodesOf(Collection<? extends GrantedAuthority> authorities) {
        return authorities.stream().map(TrainingAccessPolicy::roleCodeOf).collect(Collectors.toSet());
    }

    private static String roleCodeOf(GrantedAuthority authority) {
        String value = authority.getAuthority();
        return value != null && value.startsWith("ROLE_") ? value.substring("ROLE_".length()) : value;
    }

    private boolean sameDepartment(User actor, User targetEmployee) {
        Department actorDepartment = actor.getDepartment();
        Department targetDepartment = targetEmployee.getDepartment();
        return actorDepartment != null
                && targetDepartment != null
                && actorDepartment.getId() != null
                && actorDepartment.getId().equals(targetDepartment.getId());
    }

    private boolean hasAnyRole(Collection<String> roleCodes, String... expectedRoles) {
        for (String expectedRole : expectedRoles) {
            if (hasRole(roleCodes, expectedRole)) {
                return true;
            }
        }
        return false;
    }

    private boolean hasRole(Collection<String> roleCodes, String expectedRole) {
        return roleCodes != null && roleCodes.contains(expectedRole);
    }
}
