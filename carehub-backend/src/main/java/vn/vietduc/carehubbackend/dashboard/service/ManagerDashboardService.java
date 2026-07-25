package vn.vietduc.carehubbackend.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormSummaryResponse;
import vn.vietduc.carehubbackend.dashboard.dto.ManagerDashboardOverviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationDashboardService;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDashboardSummaryResponse;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class ManagerDashboardService {
    private static final ZoneId DASHBOARD_ZONE = ZoneId.of("Asia/Bangkok");

    private final DashboardService dashboardService;
    private final TrainingStatusService trainingStatusService;
    private final EvaluationDashboardService evaluationDashboardService;
    private final DepartmentRepository departmentRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public ManagerDashboardOverviewResponse overview(
            Long departmentId,
            LocalDate fromDate,
            LocalDate toDate,
            boolean allTime,
            Long professionalFieldId,
            boolean includeTheory
    ) {
        LocalDate today = LocalDate.now(clock.withZone(DASHBOARD_ZONE));
        LocalDate normalizedToDate = allTime ? null : toDate == null ? today : toDate;
        LocalDate normalizedFromDate = allTime
                ? null
                : fromDate == null ? normalizedToDate.minusDays(29) : fromDate;

        DashboardFormSummaryResponse formSummary = allTime
                ? dashboardService.formSummaryAllTime(departmentId)
                : dashboardService.formSummary(normalizedFromDate, normalizedToDate, departmentId);
        TrainingDashboardSummaryResponse trainingSummary = trainingStatusService.getDashboardSummary(
                new EmployeeTrainingStatusSearchRequest(
                        null,
                        departmentId,
                        null,
                        professionalFieldId,
                        null,
                        null,
                        null,
                        null,
                        today
                )
        );
        EvaluationExamDashboardResponse theorySummary = includeTheory
                ? evaluationDashboardService.examOverview(
                        allTime ? null : normalizedFromDate.atStartOfDay(),
                        allTime ? null : endOfDay(normalizedToDate),
                        null,
                        null,
                        departmentId,
                        professionalFieldId,
                        null,
                        null
                )
                : null;

        return ManagerDashboardOverviewResponse.builder()
                .generatedAt(OffsetDateTime.now(clock).atZoneSameInstant(DASHBOARD_ZONE).toOffsetDateTime())
                .scope(new ManagerDashboardOverviewResponse.Scope(
                        departmentId,
                        departmentName(departmentId)
                ))
                .period(new ManagerDashboardOverviewResponse.Period(
                        normalizedFromDate,
                        normalizedToDate,
                        allTime
                ))
                .professionalFieldId(professionalFieldId)
                .training(toTraining(trainingSummary))
                .theory(toTheory(theorySummary))
                .quality(toQuality(formSummary))
                .build();
    }

    private ManagerDashboardOverviewResponse.Training toTraining(
            TrainingDashboardSummaryResponse summary
    ) {
        TrainingDashboardSummaryResponse.Totals totals = summary.totals();
        return ManagerDashboardOverviewResponse.Training.builder()
                .asOf(summary.asOf())
                .employeeCount(totals.employeeCount())
                .configuredCount(totals.configuredCount())
                .notConfiguredCount(totals.notConfiguredCount())
                .compliantCount(totals.compliantCount())
                .atRiskCount(totals.atRiskCount())
                .nonCompliantCount(totals.nonCompliantCount())
                .needsAttentionCount(Math.max(0, totals.employeeCount() - totals.compliantCount()))
                .requiredHours(totals.requiredHours())
                .submittedHours(totals.submittedHours())
                .remainingHours(totals.remainingHours())
                .averageProgressPercentage(totals.averageProgressPercentage())
                .complianceRate(totals.complianceRate())
                .overallComplianceRate(percentage(totals.compliantCount(), totals.employeeCount()))
                .build();
    }

    private ManagerDashboardOverviewResponse.Theory toTheory(
            EvaluationExamDashboardResponse overview
    ) {
        if (overview == null) {
            return ManagerDashboardOverviewResponse.Theory.builder()
                    .available(false)
                    .averageScore(BigDecimal.ZERO)
                    .passRate(BigDecimal.ZERO)
                    .build();
        }
        EvaluationExamResultsSummaryResponse attempts = overview.attempts();
        return ManagerDashboardOverviewResponse.Theory.builder()
                .available(true)
                .assignmentCount(overview.assignmentCount())
                .targetCount(overview.targetCount())
                .notStartedCount(overview.notStartedCount())
                .gradedAttempts(attempts.gradedAttempts())
                .passedAttempts(attempts.passedAttempts())
                .failedAttempts(attempts.failedAttempts())
                .averageScore(attempts.averageScore())
                .passRate(toPercentage(attempts.passRate()))
                .build();
    }

    private ManagerDashboardOverviewResponse.Quality toQuality(
            DashboardFormSummaryResponse summary
    ) {
        DashboardFormSummaryResponse.Responses responses = summary.responses();
        return ManagerDashboardOverviewResponse.Quality.builder()
                .submittedCount(responses.submitted())
                .passedCount(responses.passed())
                .failedCount(Math.max(0, responses.submitted() - responses.passed()))
                .failedScoreCount(responses.failedScore())
                .failedCriticalCount(responses.failedCritical())
                .averageConvertedScore(responses.averageConvertedScore())
                .passRate(responses.passRate())
                .professionalFieldFilterApplied(false)
                .build();
    }

    private BigDecimal toPercentage(Double rate) {
        if (rate == null || !Double.isFinite(rate)) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(rate)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentage(long numerator, long denominator) {
        if (denominator == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(denominator), 2, RoundingMode.HALF_UP);
    }

    private String departmentName(Long departmentId) {
        if (departmentId == null) {
            return "Toàn viện";
        }
        return departmentRepository.findById(departmentId)
                .map(department -> department.getName())
                .orElse("Khoa/Phòng");
    }

    private LocalDateTime endOfDay(LocalDate date) {
        return date.plusDays(1).atStartOfDay().minusNanos(1);
    }
}
