package vn.vietduc.carehubbackend.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.dto.request.CmeApplicableDepartmentsRequest;
import vn.vietduc.carehubbackend.training.dto.response.CmeApplicableDepartmentsResponse;
import vn.vietduc.carehubbackend.training.entity.CmeScopeConfiguration;
import vn.vietduc.carehubbackend.training.repository.CmeScopeConfigurationRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CmeScopeService {
    private final CmeScopeConfigurationRepository configurationRepository;
    private final DepartmentRepository departmentRepository;

    @Transactional(readOnly = true)
    public CmeApplicableDepartmentsResponse getConfiguration() {
        return configurationRepository.findByScopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .map(this::toResponse)
                .orElseGet(() -> new CmeApplicableDepartmentsResponse(List.of(), null));
    }

    @Transactional
    public CmeApplicableDepartmentsResponse updateConfiguration(CmeApplicableDepartmentsRequest request) {
        CmeScopeConfiguration configuration = configurationRepository
                .findByScopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .orElse(null);
        if (configuration != null && !Objects.equals(configuration.getVersion(), request.version())) {
            throw new ConflictException("CME department scope was updated by another request");
        }
        if (configuration == null && request.version() != null) {
            throw new ConflictException("CME department scope was updated by another request");
        }

        Set<Long> requestedIds = new LinkedHashSet<>(request.departmentIds());
        List<Department> departments = departmentRepository.findAllById(requestedIds);
        Set<Long> foundIds = departments.stream().map(Department::getId).collect(Collectors.toSet());
        Set<Long> missingIds = requestedIds.stream()
                .filter(id -> !foundIds.contains(id))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!missingIds.isEmpty()) {
            throw new ResourceNotFoundException("Departments not found: " + missingIds);
        }

        if (configuration == null) {
            configuration = CmeScopeConfiguration.builder()
                    .scopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                    .build();
        }
        configuration.getDepartments().clear();
        departments.stream()
                .sorted(Comparator.comparing(Department::getId))
                .forEach(configuration.getDepartments()::add);
        return toResponse(configurationRepository.saveAndFlush(configuration));
    }

    @Transactional(readOnly = true)
    public Set<Long> getApplicableDepartmentIds() {
        return configurationRepository.findByScopeKey(CmeScopeConfiguration.CME_SCOPE_KEY)
                .map(configuration -> configuration.getDepartments().stream()
                        .map(Department::getId)
                        .collect(Collectors.toUnmodifiableSet()))
                .orElseGet(Set::of);
    }

    public boolean isApplicable(User employee, Set<Long> applicableDepartmentIds) {
        return employee != null
                && employee.getDepartment() != null
                && applicableDepartmentIds != null
                && applicableDepartmentIds.contains(employee.getDepartment().getId());
    }

    private CmeApplicableDepartmentsResponse toResponse(CmeScopeConfiguration configuration) {
        List<Long> departmentIds = configuration.getDepartments().stream()
                .map(Department::getId)
                .sorted()
                .toList();
        return new CmeApplicableDepartmentsResponse(departmentIds, configuration.getVersion());
    }
}
