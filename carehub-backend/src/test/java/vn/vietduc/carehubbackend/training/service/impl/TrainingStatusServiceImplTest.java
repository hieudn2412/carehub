package vn.vietduc.carehubbackend.training.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TrainingStatusServiceImplTest {
    private final TrainingAccessPolicy accessPolicy = mock(TrainingAccessPolicy.class);
    private final TrainingComplianceCalculator complianceCalculator = mock(TrainingComplianceCalculator.class);
    private final TrainingRecordRepository recordRepository = mock(TrainingRecordRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final SystemSettingsService settingsService = mock(SystemSettingsService.class);
    private TrainingStatusServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new TrainingStatusServiceImpl(
                accessPolicy,
                complianceCalculator,
                recordRepository,
                userRepository,
                settingsService
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
        when(accessPolicy.currentActor()).thenReturn(actor);
        when(accessPolicy.currentRoleCodes()).thenReturn(Set.of(TrainingAccessPolicy.ROLE_ADMIN));
        when(userRepository.searchTrainingEmployeeCandidates(isNull(), isNull(), isNull(), isNull()))
                .thenReturn(List.of(first, second));
        when(settingsService.trainingWindowYears()).thenReturn(5);
        when(settingsService.globalTrainingHours()).thenReturn(new BigDecimal("120"));
        when(recordRepository.findStatusWindowRecordsForEmployees(
                eq(List.of(2L, 3L)),
                eq(asOf.minusYears(5)),
                eq(asOf),
                anyList()
        )).thenReturn(List.of());
        when(complianceCalculator.resolveStatus(eq(new BigDecimal("120")), eq(BigDecimal.ZERO)))
                .thenReturn(ComplianceStatus.NON_COMPLIANT);

        var response = service.getDashboardSummary(new EmployeeTrainingStatusSearchRequest(
                null, null, null, null, null, null, null, null, null, asOf
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

        var attentionPage = service.getEmployeeStatuses(new EmployeeTrainingStatusSearchRequest(
                null, null, null, null, null, null, null, null, false, asOf
        ), PageRequest.of(0, 20));
        var compliantPage = service.getEmployeeStatuses(new EmployeeTrainingStatusSearchRequest(
                null, null, null, null, null, null, null, null, true, asOf
        ), PageRequest.of(0, 20));

        assertThat(attentionPage.getTotalElements()).isEqualTo(2);
        assertThat(compliantPage).isEmpty();
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
