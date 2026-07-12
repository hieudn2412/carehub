package vn.vietduc.carehubbackend.notification.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.service.CmeScopeService;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationAlertSchedulerTest {
    private final NotificationPolicyService policyService = mock(NotificationPolicyService.class);
    private final NotificationDispatcher dispatcher = mock(NotificationDispatcher.class);
    private final TrainingComplianceCalculator complianceCalculator = mock(TrainingComplianceCalculator.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    private final CmeScopeService cmeScopeService = mock(CmeScopeService.class);
    private final NotificationAlertScheduler scheduler = new NotificationAlertScheduler(
            policyService,
            dispatcher,
            complianceCalculator,
            userRepository,
            jdbc,
            cmeScopeService
    );

    @Test
    void cmeScanOnlyEvaluatesEmployeesInApplicableDepartments() {
        LocalDate today = LocalDate.of(2026, 7, 13);
        Department includedDepartment = Department.builder().id(10L).name("Included").build();
        Department excludedDepartment = Department.builder().id(20L).name("Excluded").build();
        User included = employee(1L, "EMP-1", includedDepartment);
        User excluded = employee(2L, "EMP-2", excludedDepartment);
        Set<Long> applicableDepartmentIds = Set.of(10L);

        when(policyService.getPolicy(NotificationEventType.CME_HOURS_BELOW_REQUIREMENT))
                .thenReturn(NotificationConfig.builder()
                        .enabled(true)
                        .inAppEnabled(true)
                        .emailEnabled(true)
                        .cadence(NotificationCadence.DAILY)
                        .build());
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(applicableDepartmentIds);
        when(cmeScopeService.isApplicable(any(User.class), anySet())).thenAnswer(invocation -> {
            User employee = invocation.getArgument(0);
            Set<Long> departmentIds = invocation.getArgument(1);
            return departmentIds.contains(employee.getDepartment().getId());
        });
        when(userRepository.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE))
                .thenReturn(List.of(included, excluded));
        when(complianceCalculator.calculate(included, null, today, applicableDepartmentIds))
                .thenReturn(nonCompliantStatus(included, today));
        when(userRepository.findManagersByDepartmentId(includedDepartment.getId())).thenReturn(List.of());

        scheduler.scanCme(today);

        verify(complianceCalculator).calculate(included, null, today, applicableDepartmentIds);
        verify(complianceCalculator, never()).calculate(eq(excluded), eq(null), eq(today), anySet());
        verify(dispatcher).dispatch(any(NotificationDispatchEvent.class));
    }

    private User employee(Long id, String code, Department department) {
        return User.builder()
                .id(id)
                .employeeCode(code)
                .name(code)
                .password("encoded")
                .department(department)
                .build();
    }

    private PersonalTrainingStatusResponse nonCompliantStatus(User employee, LocalDate today) {
        return new PersonalTrainingStatusResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                ComplianceStatus.NON_COMPLIANT,
                BigDecimal.valueOf(120),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.valueOf(120),
                BigDecimal.ZERO,
                5,
                today.minusYears(5),
                today,
                1L,
                "Default CME",
                "120 approved hours remaining",
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );
    }
}
