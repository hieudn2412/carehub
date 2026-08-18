package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.CmeScopeConfiguration;
import vn.vietduc.carehubbackend.training.repository.CmeScopeConfigurationRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CmeScopeService {
    private final CmeScopeConfigurationRepository configurationRepository;

    @Transactional(readOnly = true)
    public Set<Long> getApplicableDepartmentIds() {
        return configurationRepository.findByScopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .map(configuration -> configuration.getDepartments().stream()
                        .map(Department::getId)
                        .collect(Collectors.toUnmodifiableSet()))
                .orElseGet(Set::of);
    }

    public boolean isApplicable(User employee, Set<Long> applicableDepartmentIds) {
        if (employee == null || applicableDepartmentIds == null) return false;
        if (isAdmin(employee)) return true;
        return employee.getDepartment() != null
                && applicableDepartmentIds.contains(employee.getDepartment().getId());
    }

    private boolean isAdmin(User employee) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(role -> role.equals("ROLE_ADMIN"));
    }

}
