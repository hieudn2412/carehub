package vn.vietduc.carehubbackend.dashboard.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationDashboardService;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDashboardSummaryResponse;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ManagerDashboardServiceTest {
    private final DashboardService dashboardService = mock(DashboardService.class);
    private final TrainingStatusService trainingStatusService = mock(TrainingStatusService.class);
    private final EvaluationDashboardService evaluationDashboardService = mock(EvaluationDashboardService.class);
    private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-07-25T03:00:00Z"), ZoneOffset.UTC);
    private ManagerDashboardService service;

    @BeforeEach
    void setUp() {
        service = new ManagerDashboardService(
                dashboardService,
                trainingStatusService,
                evaluationDashboardService,
                departmentRepository,
                userRepository,
                clock
        );
    }

    @Test
    void employeeLookupOnlyReturnsAnActiveEmployeeFromTheManagersDepartment() {
        Department ownDepartment = Department.builder().id(10L).name("Khoa A").build();
        Department otherDepartment = Department.builder().id(11L).name("Khoa B").build();
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus("NV01", UserStatus.ACTIVE))
                .thenReturn(Optional.of(User.builder().id(7L).employeeCode("NV01").name("Nhân viên A")
                        .department(ownDepartment).build()));
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus("nv01", UserStatus.ACTIVE))
                .thenReturn(Optional.of(User.builder().id(7L).employeeCode("NV01").name("Nhân viên A")
                        .department(ownDepartment).build()));
        when(userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalseAndStatus("NV02", UserStatus.ACTIVE))
                .thenReturn(Optional.of(User.builder().id(8L).employeeCode("NV02").name("Nhân viên B")
                        .department(otherDepartment).build()));

        assertThat(service.findEmployee(10L, " nv01 ").found()).isTrue();
        assertThat(service.findEmployee(10L, "NV01").employeeId()).isEqualTo(7L);
        assertThat(service.findEmployee(10L, "NV02").found()).isFalse();
    }

    @Test
    void allTimeOverviewUsesRawQualityCountsAndDepartmentScope() {
        when(departmentRepository.findById(10L))
                .thenReturn(Optional.of(Department.builder().id(10L).name("Khoa A").build()));
        when(dashboardService.formSummaryAllTime(10L)).thenReturn(formSummary());
        when(trainingStatusService.getDashboardSummary(any())).thenReturn(trainingSummary());
        when(evaluationDashboardService.examOverview(
                null, null, null, null, 10L, 20L, null, null
        )).thenReturn(theorySummary());

        var response = service.overview(10L, null, null, true, 20L, true);

        assertThat(response.scope().departmentId()).isEqualTo(10L);
        assertThat(response.scope().departmentName()).isEqualTo("Khoa A");
        assertThat(response.period().allTime()).isTrue();
        assertThat(response.period().fromDate()).isNull();
        assertThat(response.training().employeeCount()).isEqualTo(12);
        assertThat(response.training().needsAttentionCount()).isEqualTo(5);
        assertThat(response.training().overallComplianceRate()).isEqualByComparingTo("58.33");
        assertThat(response.theory().available()).isTrue();
        assertThat(response.theory().passRate()).isEqualByComparingTo("75.00");
        assertThat(response.quality().submittedCount()).isEqualTo(8);
        assertThat(response.quality().passedCount()).isEqualTo(5);
        assertThat(response.quality().failedCount()).isEqualTo(3);
        assertThat(response.quality().failedScoreCount()).isEqualTo(2);
        assertThat(response.quality().failedCriticalCount()).isEqualTo(1);
        assertThat(response.quality().professionalFieldFilterApplied()).isFalse();
        verify(dashboardService).formSummaryAllTime(10L);
    }

    @Test
    void theoryIsOmittedWhenManagerLacksPermission() {
        when(departmentRepository.findById(10L))
                .thenReturn(Optional.of(Department.builder().id(10L).name("Khoa A").build()));
        when(dashboardService.formSummary(any(), any(), any())).thenReturn(formSummary());
        when(trainingStatusService.getDashboardSummary(any())).thenReturn(trainingSummary());

        var response = service.overview(
                10L,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2026, 7, 25),
                false,
                null,
                false
        );

        assertThat(response.theory().available()).isFalse();
        verify(evaluationDashboardService, never()).examOverview(
                any(), any(), any(), any(), any(), any(), any(), any()
        );
    }

    private DashboardFormSummaryResponse formSummary() {
        return DashboardFormSummaryResponse.builder()
                .responses(new DashboardFormSummaryResponse.Responses(
                        10,
                        8,
                        1,
                        1,
                        5,
                        2,
                        1,
                        new BigDecimal("62.50"),
                        new BigDecimal("8.40")
                ))
                .build();
    }

    private TrainingDashboardSummaryResponse trainingSummary() {
        return new TrainingDashboardSummaryResponse(
                LocalDate.of(2026, 7, 25),
                10L,
                20L,
                null,
                new TrainingDashboardSummaryResponse.Totals(
                        12,
                        10,
                        2,
                        7,
                        1,
                        2,
                        new BigDecimal("1200"),
                        new BigDecimal("900"),
                        new BigDecimal("300"),
                        new BigDecimal("75.00"),
                        new BigDecimal("70.00")
                ),
                List.of(),
                List.of(),
                List.of()
        );
    }

    private EvaluationExamDashboardResponse theorySummary() {
        return new EvaluationExamDashboardResponse(
                null,
                2,
                10,
                2,
                new EvaluationExamResultsSummaryResponse(
                        8L,
                        0L,
                        8L,
                        0L,
                        6L,
                        2L,
                        new BigDecimal("82.50"),
                        0.75,
                        120,
                        List.of()
                ),
                List.of(),
                List.of(),
                List.of()
        );
    }
}
