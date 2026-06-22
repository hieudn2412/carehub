package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingRecordLedgerResponse;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingStatusSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusActivityTypeHoursResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusRecordSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusYearlyHoursResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRequirement;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRequirementRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class TrainingStatusServiceImpl implements TrainingStatusService {
    private static final int DEFAULT_WINDOW_YEARS = 5;
    private static final int MAX_PAGE_SIZE = 100;
    private static final List<TrainingRecordStatus> LEDGER_STATUSES = List.of(
            TrainingRecordStatus.APPROVED,
            TrainingRecordStatus.PENDING_REVIEW,
            TrainingRecordStatus.REJECTED
    );

    private final TrainingAccessPolicy accessPolicy;
    private final TrainingComplianceCalculator complianceCalculator;
    private final TrainingRecordRepository recordRepository;
    private final TrainingRequirementRepository requirementRepository;
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

    @Override
    @Transactional(readOnly = true)
    public Page<EmployeeTrainingStatusSummaryResponse> getEmployeeStatuses(
            EmployeeTrainingStatusSearchRequest request,
            Pageable pageable
    ) {
        User actor = accessPolicy.currentActor();
        Set<String> roleCodes = accessPolicy.currentRoleCodes();
        if (!hasAnyRole(roleCodes, TrainingAccessPolicy.ROLE_ADMIN, TrainingAccessPolicy.ROLE_MANAGER, TrainingAccessPolicy.ROLE_SYSTEM_JOB)) {
            throw new ForbiddenException("You do not have access to employee training status list");
        }

        EmployeeTrainingStatusSearchRequest criteria = request == null
                ? new EmployeeTrainingStatusSearchRequest(null, null, null, null, null, null, null, null, null, null)
                : request;
        Pageable normalizedPageable = normalizePageable(pageable, Sort.by(Sort.Order.asc("employeeCode")));
        LocalDate asOfDate = criteria.asOf() == null ? LocalDate.now() : criteria.asOf();
        Long scopeDepartmentId = hasAnyRole(roleCodes, TrainingAccessPolicy.ROLE_ADMIN, TrainingAccessPolicy.ROLE_SYSTEM_JOB)
                ? null
                : idOf(actor.getDepartment());

        List<User> candidates = userRepository.searchTrainingEmployeeCandidates(
                scopeDepartmentId,
                normalizeKeywordPattern(criteria.keyword()),
                criteria.departmentId(),
                criteria.jobPositionId()
        );
        if (candidates.isEmpty()) {
            return new PageImpl<>(List.of(), normalizedPageable, 0);
        }

        List<TrainingRequirement> activeRequirements = requirementRepository.findActiveRequirementsAsOf(asOfDate);
        int maxCycleYears = activeRequirements.stream()
                .map(TrainingRequirement::getCycleYears)
                .filter(years -> years != null && years > 0)
                .max(Integer::compareTo)
                .orElse(DEFAULT_WINDOW_YEARS);
        Map<Long, List<TrainingRecord>> recordsByEmployee = recordsByEmployee(
                candidates,
                asOfDate.minusYears(maxCycleYears),
                asOfDate
        );

        List<EmployeeTrainingStatusSummaryResponse> summaries = candidates.stream()
                .map(employee -> summarizeEmployee(
                        employee,
                        criteria.professionalFieldId(),
                        asOfDate,
                        activeRequirements,
                        recordsByEmployee.getOrDefault(employee.getId(), List.of())
                ))
                .filter(summary -> matchesStatusFilters(summary, criteria))
                .sorted(summaryComparator(normalizedPageable.getSort()))
                .toList();

        return page(summaries, normalizedPageable);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<EmployeeTrainingRecordLedgerResponse> getEmployeeRecords(
            Long employeeId,
            Long professionalFieldId,
            LocalDate asOf,
            TrainingRecordStatus workflowStatus,
            Pageable pageable
    ) {
        User actor = accessPolicy.currentActor();
        User employee = userRepository.findById(employeeId)
                .orElseThrow(() -> new ResourceNotFoundException("Employee not found"));
        accessPolicy.requireCanReadEmployee(actor, accessPolicy.currentRoleCodes(), employee);

        Pageable normalizedPageable = normalizePageable(
                pageable,
                Sort.by(Sort.Order.desc("startDate"), Sort.Order.desc("id"))
        );
        if (workflowStatus != null && !LEDGER_STATUSES.contains(workflowStatus)) {
            return new PageImpl<>(List.of(), normalizedPageable, 0);
        }

        PersonalTrainingStatusResponse status = statusFor(employee, professionalFieldId, asOf);
        if (status.status() == ComplianceStatus.NOT_CONFIGURED || status.windowStart() == null) {
            return new PageImpl<>(List.of(), normalizedPageable, 0);
        }

        List<TrainingRecordStatus> statuses = workflowStatus == null ? LEDGER_STATUSES : List.of(workflowStatus);
        List<EmployeeTrainingRecordLedgerResponse> ledgerRows = recordRepository.findEmployeeLedgerRecords(
                employeeId,
                status.windowStart(),
                status.windowEnd(),
                statuses
        );
        List<EmployeeTrainingRecordLedgerResponse> withRunningTotals = withRunningApprovedTotals(ledgerRows).stream()
                .sorted(ledgerComparator(normalizedPageable.getSort()))
                .toList();

        return page(withRunningTotals, normalizedPageable);
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

    private Map<Long, List<TrainingRecord>> recordsByEmployee(
            List<User> employees,
            LocalDate windowStart,
            LocalDate windowEnd
    ) {
        List<Long> employeeIds = employees.stream().map(User::getId).toList();
        if (employeeIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, List<TrainingRecord>> grouped = new HashMap<>();
        recordRepository.findStatusWindowRecordsForEmployees(employeeIds, windowStart, windowEnd, LEDGER_STATUSES)
                .forEach(record -> grouped
                        .computeIfAbsent(record.getEmployee().getId(), ignored -> new ArrayList<>())
                        .add(record));
        return grouped;
    }

    private EmployeeTrainingStatusSummaryResponse summarizeEmployee(
            User employee,
            Long professionalFieldId,
            LocalDate asOf,
            List<TrainingRequirement> activeRequirements,
            List<TrainingRecord> records
    ) {
        Optional<TrainingRequirement> selectedRequirement = complianceCalculator.selectRequirementFromCandidates(
                employee,
                professionalFieldId,
                activeRequirements
        );
        Department department = employee.getDepartment();
        Position position = employee.getPosition();

        if (selectedRequirement.isEmpty()) {
            return new EmployeeTrainingStatusSummaryResponse(
                    employee.getId(),
                    employee.getEmployeeCode(),
                    employee.getName(),
                    idOf(department),
                    department == null ? null : department.getName(),
                    idOf(position),
                    position == null ? null : position.getName(),
                    null,
                    null,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    null,
                    null,
                    asOf,
                    ComplianceStatus.NOT_CONFIGURED,
                    null,
                    0,
                    "No active training requirement is configured"
            );
        }

        TrainingRequirement requirement = selectedRequirement.get();
        LocalDate windowStart = asOf.minusYears(requirement.getCycleYears());
        List<TrainingRecord> windowRecords = records.stream()
                .filter(record -> !record.getStartDate().isBefore(windowStart))
                .filter(record -> !record.getStartDate().isAfter(asOf))
                .toList();
        BigDecimal approvedHours = sumApproved(windowRecords);
        BigDecimal pendingHours = sumDeclared(windowRecords, TrainingRecordStatus.PENDING_REVIEW);
        BigDecimal rejectedHours = sumDeclared(windowRecords, TrainingRecordStatus.REJECTED);
        BigDecimal requiredHours = safe(requirement.getRequiredHours());
        BigDecimal remainingHours = requiredHours.subtract(approvedHours).max(BigDecimal.ZERO);
        BigDecimal progressPercentage = progressPercentage(requiredHours, approvedHours);
        ComplianceStatus status = complianceCalculator.resolveStatus(requirement, approvedHours);
        LocalDate lastTrainingDate = windowRecords.stream()
                .map(TrainingRecord::getStartDate)
                .max(LocalDate::compareTo)
                .orElse(null);
        long pendingReviewCount = windowRecords.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.PENDING_REVIEW)
                .count();

        return new EmployeeTrainingStatusSummaryResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                idOf(department),
                department == null ? null : department.getName(),
                idOf(position),
                position == null ? null : position.getName(),
                requirement.getId(),
                requirement.getName(),
                requiredHours,
                approvedHours,
                pendingHours,
                rejectedHours,
                remainingHours,
                progressPercentage,
                requirement.getCycleYears(),
                windowStart,
                asOf,
                status,
                lastTrainingDate,
                pendingReviewCount,
                warningMessage(status, remainingHours)
        );
    }

    private boolean matchesStatusFilters(
            EmployeeTrainingStatusSummaryResponse summary,
            EmployeeTrainingStatusSearchRequest criteria
    ) {
        if (criteria.complianceStatus() != null && summary.complianceStatus() != criteria.complianceStatus()) {
            return false;
        }
        if (criteria.hasPendingReview() != null
                && (summary.pendingReviewCount() > 0) != criteria.hasPendingReview()) {
            return false;
        }
        if (criteria.approvedHoursMin() != null
                && summary.approvedHours().compareTo(criteria.approvedHoursMin()) < 0) {
            return false;
        }
        if (criteria.approvedHoursMax() != null
                && summary.approvedHours().compareTo(criteria.approvedHoursMax()) > 0) {
            return false;
        }
        return criteria.requirementConfigured() == null
                || (summary.requirementId() != null) == criteria.requirementConfigured();
    }

    private List<EmployeeTrainingRecordLedgerResponse> withRunningApprovedTotals(
            List<EmployeeTrainingRecordLedgerResponse> rows
    ) {
        BigDecimal runningApprovedHours = BigDecimal.ZERO;
        List<EmployeeTrainingRecordLedgerResponse> result = new ArrayList<>();
        for (EmployeeTrainingRecordLedgerResponse row : rows) {
            if (row.workflowStatus() == TrainingRecordStatus.APPROVED) {
                runningApprovedHours = runningApprovedHours.add(safe(row.approvedHours()));
            }
            result.add(row.withRunningApprovedHours(runningApprovedHours));
        }
        return result;
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

    private BigDecimal sumApproved(List<TrainingRecord> records) {
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.APPROVED)
                .map(TrainingRecord::getApprovedHours)
                .map(this::safe)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal progressPercentage(BigDecimal requiredHours, BigDecimal approvedHours) {
        if (requiredHours == null || requiredHours.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.valueOf(100);
        }
        return approvedHours
                .multiply(BigDecimal.valueOf(100))
                .divide(requiredHours, 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private String warningMessage(ComplianceStatus status, BigDecimal remainingHours) {
        return switch (status) {
            case NOT_CONFIGURED -> "No active training requirement is configured";
            case COMPLIANT -> "Training requirement is met";
            case AT_RISK, NON_COMPLIANT -> remainingHours.stripTrailingZeros().toPlainString()
                    + " approved hours remaining";
        };
    }

    private Pageable normalizePageable(Pageable pageable, Sort defaultSort) {
        int page = pageable == null ? 0 : Math.max(pageable.getPageNumber(), 0);
        int size = pageable == null ? 20 : Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE);
        Sort sort = pageable == null || pageable.getSort().isUnsorted() ? defaultSort : pageable.getSort();
        return PageRequest.of(page, size, sort);
    }

    private <T> Page<T> page(List<T> items, Pageable pageable) {
        int fromIndex = Math.min((int) pageable.getOffset(), items.size());
        int toIndex = Math.min(fromIndex + pageable.getPageSize(), items.size());
        return new PageImpl<>(new ArrayList<>(items.subList(fromIndex, toIndex)), pageable, items.size());
    }

    private Comparator<EmployeeTrainingStatusSummaryResponse> summaryComparator(Sort sort) {
        Comparator<EmployeeTrainingStatusSummaryResponse> comparator = null;
        for (Sort.Order order : sort) {
            Comparator<EmployeeTrainingStatusSummaryResponse> next = switch (order.getProperty()) {
                case "employeeCode" -> comparingValue(EmployeeTrainingStatusSummaryResponse::employeeCode, order.getDirection());
                case "employeeName", "name" -> comparingValue(EmployeeTrainingStatusSummaryResponse::employeeName, order.getDirection());
                case "departmentName" -> comparingValue(EmployeeTrainingStatusSummaryResponse::departmentName, order.getDirection());
                case "jobPositionName", "positionName" -> comparingValue(EmployeeTrainingStatusSummaryResponse::jobPositionName, order.getDirection());
                case "requirementName" -> comparingValue(EmployeeTrainingStatusSummaryResponse::requirementName, order.getDirection());
                case "requiredHours" -> comparingValue(EmployeeTrainingStatusSummaryResponse::requiredHours, order.getDirection());
                case "approvedHours" -> comparingValue(EmployeeTrainingStatusSummaryResponse::approvedHours, order.getDirection());
                case "pendingHours" -> comparingValue(EmployeeTrainingStatusSummaryResponse::pendingHours, order.getDirection());
                case "remainingHours" -> comparingValue(EmployeeTrainingStatusSummaryResponse::remainingHours, order.getDirection());
                case "status", "complianceStatus" -> comparingValue(EmployeeTrainingStatusSummaryResponse::complianceStatus, order.getDirection());
                case "lastTrainingDate" -> comparingValue(EmployeeTrainingStatusSummaryResponse::lastTrainingDate, order.getDirection());
                case "pendingReviewCount" -> comparingValue(EmployeeTrainingStatusSummaryResponse::pendingReviewCount, order.getDirection());
                default -> throw new IllegalArgumentException("Unsupported employee training status sort property: " + order.getProperty());
            };
            comparator = comparator == null ? next : comparator.thenComparing(next);
        }
        return comparator == null
                ? comparingValue(EmployeeTrainingStatusSummaryResponse::employeeCode, Sort.Direction.ASC)
                : comparator;
    }

    private Comparator<EmployeeTrainingRecordLedgerResponse> ledgerComparator(Sort sort) {
        Comparator<EmployeeTrainingRecordLedgerResponse> comparator = null;
        for (Sort.Order order : sort) {
            Comparator<EmployeeTrainingRecordLedgerResponse> next = switch (order.getProperty()) {
                case "id" -> comparingValue(EmployeeTrainingRecordLedgerResponse::id, order.getDirection());
                case "title" -> comparingValue(EmployeeTrainingRecordLedgerResponse::title, order.getDirection());
                case "activityTypeName" -> comparingValue(EmployeeTrainingRecordLedgerResponse::activityTypeName, order.getDirection());
                case "startDate" -> comparingValue(EmployeeTrainingRecordLedgerResponse::startDate, order.getDirection());
                case "endDate" -> comparingValue(EmployeeTrainingRecordLedgerResponse::endDate, order.getDirection());
                case "declaredHours" -> comparingValue(EmployeeTrainingRecordLedgerResponse::declaredHours, order.getDirection());
                case "approvedHours" -> comparingValue(EmployeeTrainingRecordLedgerResponse::approvedHours, order.getDirection());
                case "runningApprovedHours" -> comparingValue(EmployeeTrainingRecordLedgerResponse::runningApprovedHours, order.getDirection());
                case "workflowStatus" -> comparingValue(EmployeeTrainingRecordLedgerResponse::workflowStatus, order.getDirection());
                case "sourceType" -> comparingValue(EmployeeTrainingRecordLedgerResponse::sourceType, order.getDirection());
                case "evidenceCount" -> comparingValue(EmployeeTrainingRecordLedgerResponse::evidenceCount, order.getDirection());
                default -> throw new IllegalArgumentException("Unsupported employee training records sort property: " + order.getProperty());
            };
            comparator = comparator == null ? next : comparator.thenComparing(next);
        }
        return comparator == null
                ? comparingValue(EmployeeTrainingRecordLedgerResponse::startDate, Sort.Direction.DESC)
                : comparator;
    }

    private <T, U extends Comparable<? super U>> Comparator<T> comparingValue(
            Function<T, U> extractor,
            Sort.Direction direction
    ) {
        Comparator<U> valueComparator = direction.isAscending()
                ? Comparator.nullsLast(Comparator.naturalOrder())
                : Comparator.nullsLast(Comparator.reverseOrder());
        return Comparator.comparing(extractor, valueComparator);
    }

    private String normalizeKeywordPattern(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return "%" + keyword.trim().toLowerCase() + "%";
    }

    private Long idOf(Department department) {
        return department == null ? null : department.getId();
    }

    private Long idOf(Position position) {
        return position == null ? null : position.getId();
    }

    private boolean hasAnyRole(Set<String> roleCodes, String... expectedRoles) {
        for (String expectedRole : expectedRoles) {
            if (roleCodes.contains(expectedRole)) {
                return true;
            }
        }
        return false;
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
