package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TrainingComplianceCalculatorTest {
    private final TrainingRequirementRepository requirementRepository = mock(TrainingRequirementRepository.class);
    private final TrainingRecordRepository recordRepository = mock(TrainingRecordRepository.class);
    private final CmeScopeService cmeScopeService = mock(CmeScopeService.class);
    private final TrainingComplianceCalculator calculator = new TrainingComplianceCalculator(
            requirementRepository,
            recordRepository,
            cmeScopeService
    );

    @BeforeEach
    void setUpScope() {
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(Set.of(10L));
        when(cmeScopeService.isApplicable(any(User.class), anySet())).thenAnswer(invocation -> {
            User employee = invocation.getArgument(0);
            Set<Long> departmentIds = invocation.getArgument(1);
            return employee.getDepartment() != null && departmentIds.contains(employee.getDepartment().getId());
        });
    }

    @Test
    void missingRequirementReturnsNotConfigured() {
        User employee = employee();
        when(requirementRepository.findActiveCandidates(eq(10L), eq(20L), eq(null), any(LocalDate.class)))
                .thenReturn(List.of());

        var status = calculator.calculate(employee, null, LocalDate.of(2026, 6, 16));

        assertThat(status.status()).isEqualTo(ComplianceStatus.NOT_CONFIGURED);
        assertThat(status.requirementId()).isNull();
    }

    @Test
    void onlySubmittedRecordsAreSummed() {
        TrainingRecord submitted = TrainingRecord.builder()
                .workflowStatus(TrainingRecordStatus.SUBMITTED)
                .declaredHours(BigDecimal.valueOf(5))
                .build();
        TrainingRecord draft = TrainingRecord.builder()
                .workflowStatus(TrainingRecordStatus.DRAFT)
                .declaredHours(BigDecimal.valueOf(100))
                .build();
        TrainingRecord cancelled = TrainingRecord.builder()
                .workflowStatus(TrainingRecordStatus.CANCELLED)
                .declaredHours(BigDecimal.valueOf(50))
                .build();

        BigDecimal total = calculator.sumSubmittedHours(List.of(submitted, draft, cancelled));

        assertThat(total).isEqualByComparingTo("5");
    }

    @Test
    void warningThresholdEnablesAtRiskStatus() {
        TrainingRequirement requirement = TrainingRequirement.builder()
                .requiredHours(BigDecimal.valueOf(120))
                .warningThresholdHours(BigDecimal.valueOf(80))
                .build();

        ComplianceStatus status = calculator.resolveStatus(requirement, BigDecimal.valueOf(90));

        assertThat(status).isEqualTo(ComplianceStatus.AT_RISK);
    }

    @Test
    void compliantWhenSubmittedHoursMeetRequired() {
        TrainingRequirement requirement = TrainingRequirement.builder()
                .requiredHours(BigDecimal.valueOf(120))
                .warningThresholdHours(BigDecimal.valueOf(80))
                .build();

        ComplianceStatus status = calculator.resolveStatus(requirement, BigDecimal.valueOf(120));

        assertThat(status).isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    void nonCompliantBelowWarningThreshold() {
        TrainingRequirement requirement = TrainingRequirement.builder()
                .requiredHours(BigDecimal.valueOf(120))
                .warningThresholdHours(BigDecimal.valueOf(80))
                .build();

        ComplianceStatus status = calculator.resolveStatus(requirement, BigDecimal.valueOf(50));

        assertThat(status).isEqualTo(ComplianceStatus.NON_COMPLIANT);
    }

    @Test
    void employeeOutsideConfiguredDepartmentsIsNotConfigured() {
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(Set.of(999L));

        var status = calculator.calculate(employee(), null, LocalDate.of(2026, 6, 16));

        assertThat(status.status()).isEqualTo(ComplianceStatus.NOT_CONFIGURED);
        assertThat(status.requirementId()).isNull();
    }

    private User employee() {
        Department department = Department.builder().id(10L).name("ICU").build();
        Position position = Position.builder().id(20L).name("Doctor").build();
        return User.builder()
                .id(1L)
                .employeeCode("VD001")
                .name("Employee")
                .password("password")
                .department(department)
                .position(position)
                .build();
    }
}
