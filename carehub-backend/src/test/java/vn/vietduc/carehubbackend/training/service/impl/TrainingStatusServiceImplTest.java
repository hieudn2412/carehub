package vn.vietduc.carehubbackend.training.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.training.service.CmeScopeService;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TrainingStatusServiceImplTest {
    private final TrainingAccessPolicy accessPolicy = mock(TrainingAccessPolicy.class);
    private final TrainingComplianceCalculator complianceCalculator = mock(TrainingComplianceCalculator.class);
    private final TrainingRecordRepository recordRepository = mock(TrainingRecordRepository.class);
    private final TrainingRequirementRepository requirementRepository = mock(TrainingRequirementRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CmeScopeService cmeScopeService = mock(CmeScopeService.class);
    private TrainingStatusServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TrainingStatusServiceImpl(
                accessPolicy,
                complianceCalculator,
                recordRepository,
                requirementRepository,
                userRepository,
                cmeScopeService
        );
    }

    @Test
    void dashboardSummaryUsesApplicableRequirementAndGroupsByDepartment() {
        LocalDate asOf = LocalDate.of(2026, 7, 25);
        Department emergency = Department.builder().id(10L).name("Cấp cứu").build();
        Department surgery = Department.builder().id(11L).name("Ngoại").build();
        User actor = employee(1L, "ADMIN", emergency);
        User first = employee(2L, "NV002", emergency);
        User second = employee(3L, "NV003", surgery);
        TrainingRequirement requirement = TrainingRequirement.builder()
                .id(20L)
                .code("CME-120")
                .name("Chuẩn CME")
                .requiredHours(new BigDecimal("120"))
                .warningThresholdHours(new BigDecimal("80"))
                .cycleYears(5)
                .effectiveFrom(asOf.minusYears(1))
                .build();

        when(accessPolicy.currentActor()).thenReturn(actor);
        when(accessPolicy.currentRoleCodes()).thenReturn(Set.of(TrainingAccessPolicy.ROLE_ADMIN));
        when(userRepository.searchTrainingEmployeeCandidates(isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of(first, second));
        when(requirementRepository.findActiveRequirementsAsOf(asOf)).thenReturn(List.of(requirement));
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(Set.of(10L, 11L));
        when(recordRepository.findStatusWindowRecordsForEmployees(
                eq(List.of(2L, 3L)),
                eq(asOf.minusYears(5)),
                eq(asOf),
                anyList()
        )).thenReturn(List.of());
        when(complianceCalculator.selectRequirementFromCandidates(
                any(User.class),
                isNull(),
                eq(List.of(requirement)),
                anySet()
        )).thenReturn(Optional.of(requirement));
        when(complianceCalculator.resolveStatus(eq(requirement), eq(BigDecimal.ZERO)))
                .thenReturn(ComplianceStatus.NON_COMPLIANT);

        var response = service.getDashboardSummary(new EmployeeTrainingStatusSearchRequest(
                null, null, null, null, null, null, null, null, asOf
        ));

        assertThat(response.asOf()).isEqualTo(asOf);
        assertThat(response.totals().employeeCount()).isEqualTo(2);
        assertThat(response.totals().configuredCount()).isEqualTo(2);
        assertThat(response.totals().nonCompliantCount()).isEqualTo(2);
        assertThat(response.totals().requiredHours()).isEqualByComparingTo("240");
        assertThat(response.totals().remainingHours()).isEqualByComparingTo("240");
        assertThat(response.byDepartment())
                .extracting("departmentName")
                .containsExactly("Cấp cứu", "Ngoại");
    }

    private User employee(Long id, String employeeCode, Department department) {
        return User.builder()
                .id(id)
                .employeeCode(employeeCode)
                .name("Nhân viên " + id)
                .password("password")
                .department(department)
                .build();
    }
}
