package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusActivityTypeHoursResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusRecordSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusYearlyHoursResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrainingStatusServiceImpl implements TrainingStatusService {
    private final TrainingAccessPolicy accessPolicy;
    private final TrainingComplianceCalculator complianceCalculator;
    private final TrainingRecordRepository recordRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public PersonalTrainingStatusResponse getMyStatus(Long professionalFieldId, LocalDate asOf) {
        return statusFor(accessPolicy.currentActor(), professionalFieldId, asOf);
    }

    @Override
    @Transactional(readOnly = true)
    public PersonalTrainingStatusResponse getEmployeeStatus(Long employeeId, Long professionalFieldId, LocalDate asOf) {
        User actor = accessPolicy.currentActor();
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        accessPolicy.requireCanReadEmployee(actor, accessPolicy.currentRoleCodes(), employee);
        return statusFor(employee, professionalFieldId, asOf);
    }

    private PersonalTrainingStatusResponse statusFor(User employee, Long professionalFieldId, LocalDate asOf) {
        PersonalTrainingStatusResponse base = complianceCalculator.calculate(employee, professionalFieldId, asOf);
        if (base.status() == ComplianceStatus.NOT_CONFIGURED || base.windowStart() == null) {
            return base;
        }

        List<TrainingRecord> records = recordRepository.findComplianceWindowRecords(
                employee.getId(),
                base.windowStart(),
                base.windowEnd()
        );
        BigDecimal pendingHours = sumDeclared(records, TrainingRecordStatus.PENDING_REVIEW);
        BigDecimal rejectedHours = sumDeclared(records, TrainingRecordStatus.REJECTED);

        return new PersonalTrainingStatusResponse(
                base.employeeId(),
                base.employeeCode(),
                base.employeeName(),
                base.status(),
                base.requiredHours(),
                base.approvedHours(),
                pendingHours,
                rejectedHours,
                base.remainingHours(),
                base.progressPercentage(),
                base.cycleYears(),
                base.windowStart(),
                base.windowEnd(),
                base.requirementId(),
                base.requirementName(),
                base.warningMessage(),
                yearlyHours(records),
                activityTypeHours(records),
                recentRecords(records),
                attentionRecords(records)
        );
    }

    private List<TrainingStatusYearlyHoursResponse> yearlyHours(List<TrainingRecord> records) {
        Map<Integer, Totals> totals = new LinkedHashMap<>();
        records.stream()
                .sorted(Comparator.comparing(TrainingRecord::getStartDate))
                .forEach(record -> totals
                        .computeIfAbsent(record.getStartDate().getYear(), ignored -> new Totals())
                        .add(record));
        return totals.entrySet()
                .stream()
                .map(entry -> new TrainingStatusYearlyHoursResponse(
                        entry.getKey(),
                        entry.getValue().approvedHours,
                        entry.getValue().pendingHours,
                        entry.getValue().rejectedHours
                ))
                .toList();
    }

    private List<TrainingStatusActivityTypeHoursResponse> activityTypeHours(List<TrainingRecord> records) {
        Map<Long, ActivityTotals> totals = new LinkedHashMap<>();
        records.forEach(record -> {
            Long activityTypeId = record.getActivityType() == null ? null : record.getActivityType().getId();
            String activityTypeName = record.getActivityType() == null ? null : record.getActivityType().getName();
            totals.computeIfAbsent(activityTypeId, ignored -> new ActivityTotals(activityTypeId, activityTypeName))
                    .add(record);
        });
        return totals.values()
                .stream()
                .map(total -> new TrainingStatusActivityTypeHoursResponse(
                        total.activityTypeId,
                        total.activityTypeName,
                        total.approvedHours,
                        total.pendingHours,
                        total.rejectedHours
                ))
                .toList();
    }

    private List<TrainingStatusRecordSummaryResponse> recentRecords(List<TrainingRecord> records) {
        return records.stream()
                .limit(10)
                .map(this::recordSummary)
                .toList();
    }

    private List<TrainingStatusRecordSummaryResponse> attentionRecords(List<TrainingRecord> records) {
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.PENDING_REVIEW
                        || record.getWorkflowStatus() == TrainingRecordStatus.REJECTED)
                .limit(10)
                .map(this::recordSummary)
                .toList();
    }

    private TrainingStatusRecordSummaryResponse recordSummary(TrainingRecord record) {
        return new TrainingStatusRecordSummaryResponse(
                record.getId(),
                record.getTitle(),
                record.getActivityType() == null ? null : record.getActivityType().getName(),
                record.getStartDate(),
                record.getDeclaredHours(),
                record.getApprovedHours(),
                record.getWorkflowStatus()
        );
    }

    private BigDecimal sumDeclared(List<TrainingRecord> records, TrainingRecordStatus status) {
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == status)
                .map(TrainingRecord::getDeclaredHours)
                .map(this::safe)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private class Totals {
        protected BigDecimal approvedHours = BigDecimal.ZERO;
        protected BigDecimal pendingHours = BigDecimal.ZERO;
        protected BigDecimal rejectedHours = BigDecimal.ZERO;

        protected void add(TrainingRecord record) {
            if (record.getWorkflowStatus() == TrainingRecordStatus.APPROVED) {
                approvedHours = approvedHours.add(safe(record.getApprovedHours()));
            } else if (record.getWorkflowStatus() == TrainingRecordStatus.PENDING_REVIEW) {
                pendingHours = pendingHours.add(safe(record.getDeclaredHours()));
            } else if (record.getWorkflowStatus() == TrainingRecordStatus.REJECTED) {
                rejectedHours = rejectedHours.add(safe(record.getDeclaredHours()));
            }
        }
    }

    private class ActivityTotals extends Totals {
        private final Long activityTypeId;
        private final String activityTypeName;

        private ActivityTotals(Long activityTypeId, String activityTypeName) {
            this.activityTypeId = activityTypeId;
            this.activityTypeName = activityTypeName;
        }
    }
}
