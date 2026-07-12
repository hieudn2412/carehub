package vn.vietduc.carehubbackend.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationCadence;
import vn.vietduc.carehubbackend.notification.entity.NotificationConfig;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.training.service.CmeScopeService;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.WeekFields;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "app.notification", name = "scheduling-enabled", havingValue = "true", matchIfMissing = true)
public class NotificationAlertScheduler {
    private final NotificationPolicyService policyService;
    private final NotificationDispatcher dispatcher;
    private final TrainingComplianceCalculator complianceCalculator;
    private final UserRepository userRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final CmeScopeService cmeScopeService;

    @Value("${app.notification.zone:Asia/Bangkok}")
    private String notificationZone;

    @Scheduled(cron = "${app.notification.scan-cron:0 0 7 * * *}", zone = "${app.notification.zone:Asia/Bangkok}")
    public void scanAlerts() {
        LocalDate today = LocalDate.now(businessZone());
        try {
            scanCme(today);
        } catch (RuntimeException ex) {
            log.error("CME notification scan failed", ex);
        }
        try {
            scanQuality(today);
        } catch (RuntimeException ex) {
            log.error("Quality notification scan failed", ex);
        }
    }

    void scanCme(LocalDate today) {
        NotificationConfig policy = policyService.getPolicy(NotificationEventType.CME_HOURS_BELOW_REQUIREMENT);
        if (!policy.isEnabled() || !isDue(policy.getCadence(), today)) {
            return;
        }
        Set<Long> applicableDepartmentIds = cmeScopeService.getApplicableDepartmentIds();
        if (applicableDepartmentIds.isEmpty()) {
            return;
        }
        for (User employee : userRepository.findByIsDeletedFalseAndStatus(UserStatus.ACTIVE)) {
            if (!cmeScopeService.isApplicable(employee, applicableDepartmentIds)) {
                continue;
            }
            try {
                PersonalTrainingStatusResponse status = complianceCalculator.calculate(
                        employee,
                        null,
                        today,
                        applicableDepartmentIds
                );
                if (status.status() != ComplianceStatus.AT_RISK
                        && status.status() != ComplianceStatus.NON_COMPLIANT) {
                    continue;
                }
                Map<String, String> variables = cmeVariables(employee, status);
                dispatcher.dispatch(new NotificationDispatchEvent(
                        NotificationEventType.CME_HOURS_BELOW_REQUIREMENT,
                        employee.getId(),
                        NotificationAudience.EMPLOYEE,
                        "WARNING",
                        "Bạn chưa đạt yêu cầu giờ CME",
                        "Bạn còn thiếu " + decimal(status.remainingHours()) + " giờ CME.",
                        "/staff/training",
                        "CME:" + employee.getId() + ":EMPLOYEE:" + cadenceBucket(policy.getCadence(), today),
                        variables
                ));
                if (employee.getDepartment() != null) {
                    for (User manager : userRepository.findManagersByDepartmentId(employee.getDepartment().getId())) {
                        if (manager.getId().equals(employee.getId())) {
                            continue;
                        }
                        dispatcher.dispatch(new NotificationDispatchEvent(
                                NotificationEventType.CME_HOURS_BELOW_REQUIREMENT,
                                manager.getId(),
                                NotificationAudience.MANAGER,
                                "WARNING",
                                "Nhân viên chưa đạt yêu cầu giờ CME",
                                employee.getName() + " còn thiếu " + decimal(status.remainingHours()) + " giờ CME.",
                                "/manager/training-status",
                                "CME:" + employee.getId() + ":MANAGER:" + cadenceBucket(policy.getCadence(), today),
                                variables
                        ));
                    }
                }
            } catch (RuntimeException ex) {
                log.warn("Could not evaluate CME notification for user {}", employee.getId(), ex);
            }
        }
    }

    private void scanQuality(LocalDate today) {
        NotificationConfig policy = policyService.getPolicy(NotificationEventType.QUALITY_COMPLIANCE_BELOW_TARGET);
        if (!policy.isEnabled() || !isDue(policy.getCadence(), today)) {
            return;
        }
        BigDecimal target = policy.getThresholdPercent() == null ? BigDecimal.valueOf(90) : policy.getThresholdPercent();
        Instant from = today.minusDays(29).atStartOfDay(businessZone()).toInstant();
        List<DepartmentCompliance> departments = jdbc.query("""
                select
                    department.id as department_id,
                    department.name as department_name,
                    count(*) as submitted_count,
                    round((count(*) filter (where submission.result_status = 'PASSED') * 100.0
                        / count(*))::numeric, 2) as compliance_rate
                from form_submissions submission
                join form_submission_contexts context on context.submission_id = submission.id
                join users subject_user on subject_user.id = context.subject_user_id
                join departments department on department.id = subject_user.department_id
                where submission.status = 'SUBMITTED'
                  and submission.submitted_at >= :from
                group by department.id, department.name
                """, new MapSqlParameterSource("from", from), (rs, rowNum) -> new DepartmentCompliance(
                rs.getLong("department_id"),
                rs.getString("department_name"),
                rs.getLong("submitted_count"),
                rs.getBigDecimal("compliance_rate")
        ));
        String period = today.minusDays(29) + " - " + today;
        for (DepartmentCompliance department : departments) {
            if (department.complianceRate().compareTo(target) >= 0) {
                continue;
            }
            for (User manager : userRepository.findManagersByDepartmentId(department.departmentId())) {
                Map<String, String> variables = new LinkedHashMap<>();
                variables.put("manager_name", manager.getName());
                variables.put("department", department.departmentName());
                variables.put("compliance_rate", decimal(department.complianceRate()));
                variables.put("target_rate", decimal(target));
                variables.put("period", period);
                try {
                    dispatcher.dispatch(new NotificationDispatchEvent(
                            NotificationEventType.QUALITY_COMPLIANCE_BELOW_TARGET,
                            manager.getId(),
                            NotificationAudience.MANAGER,
                            "WARNING",
                            "Tỷ lệ tuân thủ dưới mức mục tiêu",
                            "Tỷ lệ tuân thủ của " + department.departmentName() + " hiện là "
                                    + decimal(department.complianceRate()) + "%.",
                            "/manager/dashboard",
                            "QUALITY:" + department.departmentId() + ":" + cadenceBucket(policy.getCadence(), today),
                            variables
                    ));
                } catch (RuntimeException ex) {
                    log.warn("Could not dispatch quality notification to manager {}", manager.getId(), ex);
                }
            }
        }
    }

    private Map<String, String> cmeVariables(User employee, PersonalTrainingStatusResponse status) {
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("employee_name", employee.getName());
        variables.put("employee_code", employee.getEmployeeCode());
        variables.put("department", employee.getDepartment() == null ? "" : employee.getDepartment().getName());
        variables.put("current_hours", decimal(status.submittedHours()));
        variables.put("required_hours", decimal(status.requiredHours()));
        variables.put("missing_hours", decimal(status.remainingHours()));
        variables.put("deadline", status.windowEnd() == null ? "" : status.windowEnd().toString());
        return variables;
    }

    private boolean isDue(NotificationCadence cadence, LocalDate today) {
        return switch (cadence) {
            case IMMEDIATE, DAILY -> true;
            case WEEKLY -> today.getDayOfWeek().getValue() == 1;
            case MONTHLY -> today.getDayOfMonth() == 1;
        };
    }

    private String cadenceBucket(NotificationCadence cadence, LocalDate today) {
        return switch (cadence) {
            case IMMEDIATE, DAILY -> today.toString();
            case WEEKLY -> {
                WeekFields weekFields = WeekFields.ISO;
                yield today.get(weekFields.weekBasedYear()) + "-W" + today.get(weekFields.weekOfWeekBasedYear());
            }
            case MONTHLY -> today.getYear() + "-" + String.format(Locale.ROOT, "%02d", today.getMonthValue());
        };
    }

    private String decimal(BigDecimal value) {
        return value == null ? "0" : value.stripTrailingZeros().toPlainString();
    }

    private ZoneId businessZone() {
        return ZoneId.of(notificationZone);
    }

    private record DepartmentCompliance(
            long departmentId,
            String departmentName,
            long submittedCount,
            BigDecimal complianceRate
    ) {
    }
}
