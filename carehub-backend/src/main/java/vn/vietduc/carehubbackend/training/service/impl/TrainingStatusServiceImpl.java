package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ForbiddenException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingRecordLedgerResponse;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingStatusSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.dto.response.ProfessionalFieldHoursItemResponse;
import vn.vietduc.carehubbackend.training.dto.response.ProfessionalFieldHoursResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusActivityTypeHoursResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDashboardSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusRecordSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingStatusYearlyHoursResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.ProfessionalFieldModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingComplianceCalculator;
import vn.vietduc.carehubbackend.training.service.TrainingRecordValidity;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.Position;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class TrainingStatusServiceImpl implements TrainingStatusService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final String UNASSIGNED_PROFESSIONAL_FIELD = "Chưa xác định";
    private static final String OTHER_PROFESSIONAL_FIELD = "Lĩnh vực khác";

    private static final List<TrainingRecordStatus> LEDGER_STATUSES = List.of(
            TrainingRecordStatus.SUBMITTED,
            TrainingRecordStatus.DRAFT,
            TrainingRecordStatus.CANCELLED
    );

    private final TrainingAccessPolicy accessPolicy;
    private final TrainingComplianceCalculator complianceCalculator;
    private final TrainingRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final SystemSettingsService settingsService;

    @Override
    @Transactional(readOnly = true)
    public PersonalTrainingStatusResponse getMyStatus(Long professionalFieldId, LocalDate asOf) {
        return statusFor(accessPolicy.currentActor(), professionalFieldId, asOf);
    }

    @Override
    @Transactional(readOnly = true)
    public ProfessionalFieldHoursResponse getMyProfessionalFieldHours(Integer year) {
        User actor = accessPolicy.currentActor();
        Year selectedYear = resolveYear(year);

        Map<String, ProfessionalFieldHoursItemResponse> groupedFields = new LinkedHashMap<>();
        recordRepository
                .summarizeSubmittedHoursByProfessionalField(
                        actor.getId(),
                        selectedYear.atDay(1),
                        selectedYear.atMonth(12).atEndOfMonth()
                )
                .stream()
                .forEach(row -> {
                    boolean rejected = row.getProfessionalFieldModerationStatus() == ProfessionalFieldModerationStatus.REJECTED;
                    String key = rejected
                            ? "OTHER"
                            : row.getProfessionalFieldId() == null ? "UNASSIGNED" : "FIELD:" + row.getProfessionalFieldId();
                    String name = rejected
                            ? OTHER_PROFESSIONAL_FIELD
                            : row.getProfessionalFieldName() == null ? UNASSIGNED_PROFESSIONAL_FIELD : row.getProfessionalFieldName();
                    Long fieldId = rejected ? null : row.getProfessionalFieldId();
                    BigDecimal hours = safe(row.getSubmittedHours());
                    ProfessionalFieldHoursItemResponse current = groupedFields.get(key);
                    groupedFields.put(key, current == null
                            ? new ProfessionalFieldHoursItemResponse(fieldId, name, hours)
                            : new ProfessionalFieldHoursItemResponse(fieldId, name, safe(current.submittedHours()).add(hours)));
                });

        List<ProfessionalFieldHoursItemResponse> fields = groupedFields.values().stream()
                .sorted(Comparator
                        .comparing(
                                ProfessionalFieldHoursItemResponse::submittedHours,
                                Comparator.reverseOrder()
                        )
                        .thenComparing(
                                ProfessionalFieldHoursItemResponse::professionalFieldName,
                                String.CASE_INSENSITIVE_ORDER
                        ))
                .toList();

        TreeSet<Integer> availableYears = new TreeSet<>(Comparator.reverseOrder());
        availableYears.add(Year.now().getValue());
        availableYears.addAll(recordRepository.findSubmittedTrainingYears(actor.getId()));

        return new ProfessionalFieldHoursResponse(
                selectedYear.getValue(),
                List.copyOf(availableYears),
                fields
        );
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
        EmployeeTrainingStatusSearchRequest criteria = normalizeCriteria(request);
        Pageable normalizedPageable = normalizePageable(pageable, Sort.by(Sort.Order.asc("employeeCode")));
        List<EmployeeTrainingStatusSummaryResponse> summaries =
                employeeStatusSummaries(criteria, normalizedPageable.getSort());
        return page(summaries, normalizedPageable);
    }

    @Override
    @Transactional(readOnly = true)
    public TrainingDashboardSummaryResponse getDashboardSummary(EmployeeTrainingStatusSearchRequest request) {
        EmployeeTrainingStatusSearchRequest criteria = normalizeCriteria(request);
        LocalDate asOfDate = criteria.asOf() == null ? LocalDate.now() : criteria.asOf();
        List<EmployeeStatusContext> contexts = employeeStatusContexts(criteria);
        List<EmployeeTrainingStatusSummaryResponse> summaries = contexts.stream()
                .map(EmployeeStatusContext::summary)
                .sorted(summaryComparator(Sort.by(Sort.Order.asc("employeeCode"))))
                .toList();
        List<TrainingRecord> windowRecords = contexts.stream()
                .flatMap(context -> context.windowRecords().stream())
                .toList();

        Map<Long, List<EmployeeTrainingStatusSummaryResponse>> byDepartment = new HashMap<>();
        summaries.forEach(summary -> byDepartment
                .computeIfAbsent(summary.departmentId(), ignored -> new ArrayList<>())
                .add(summary));
        List<TrainingDashboardSummaryResponse.DepartmentItem> departmentItems = byDepartment.values().stream()
                .map(this::departmentDashboardItem)
                .sorted(Comparator.comparing(
                        TrainingDashboardSummaryResponse.DepartmentItem::departmentName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();

        return new TrainingDashboardSummaryResponse(
                asOfDate,
                criteria.departmentId(),
                criteria.professionalFieldId(),
                criteria.complianceStatus(),
                dashboardTotals(summaries),
                departmentItems,
                professionalFieldDashboardItems(windowRecords),
                activityTypeDashboardItems(windowRecords)
        );
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
        LocalDate asOfDate = asOf == null ? LocalDate.now() : asOf;
        int windowYears = settingsService.trainingWindowYears();
        List<TrainingRecordStatus> statuses = workflowStatus == null ? LEDGER_STATUSES : List.of(workflowStatus);
        List<EmployeeTrainingRecordLedgerResponse> ledgerRows = recordRepository.findEmployeeLedgerRecords(
                employeeId,
                statuses
        );
        List<EmployeeTrainingRecordLedgerResponse> withValidity = ledgerRows.stream()
                .map(row -> row.withValidity(
                        TrainingRecordValidity.validUntil(row.startDate(), windowYears),
                        TrainingRecordValidity.isExpired(row.startDate(), asOfDate, windowYears)
                ))
                .toList();
        List<EmployeeTrainingRecordLedgerResponse> withRunningTotals = withRunningSubmittedTotals(
                withValidity,
                asOfDate,
                windowYears
        ).stream()
                .sorted(ledgerComparator(normalizedPageable.getSort()))
                .toList();

        return page(withRunningTotals, normalizedPageable);
    }

    // ── Private helpers ──────────────────────────────────────────

    private EmployeeTrainingStatusSearchRequest normalizeCriteria(EmployeeTrainingStatusSearchRequest request) {
        return request == null
                ? new EmployeeTrainingStatusSearchRequest(null, null, null, null, null, null, null, null, null, null, null)
                : request;
    }

    private List<EmployeeTrainingStatusSummaryResponse> employeeStatusSummaries(
            EmployeeTrainingStatusSearchRequest criteria,
            Sort sort
    ) {
        return employeeStatusContexts(criteria).stream()
                .map(EmployeeStatusContext::summary)
                .sorted(summaryComparator(sort))
                .toList();
    }

    private List<EmployeeStatusContext> employeeStatusContexts(
            EmployeeTrainingStatusSearchRequest criteria
    ) {
        User actor = accessPolicy.currentActor();
        Set<String> roleCodes = accessPolicy.currentRoleCodes();
        if (!hasAnyRole(roleCodes, TrainingAccessPolicy.ROLE_ADMIN, TrainingAccessPolicy.ROLE_MANAGER, TrainingAccessPolicy.ROLE_SYSTEM_JOB)) {
            throw new ForbiddenException("Bạn không có quyền truy cập danh sách trạng thái đào tạo nhân viên");
        }

        LocalDate asOfDate = criteria.asOf() == null ? LocalDate.now() : criteria.asOf();
        Long scopeDepartmentId = hasAnyRole(roleCodes, TrainingAccessPolicy.ROLE_ADMIN, TrainingAccessPolicy.ROLE_SYSTEM_JOB)
                ? null
                : idOf(actor.getDepartment());
        List<User> candidates = userRepository.searchTrainingEmployeeCandidates(
                scopeDepartmentId,
                normalizeKeywordPattern(criteria.keyword()),
                criteria.departmentId(),
                criteria.jobPositionId()
        ).stream()
                .filter(employee -> criteria.employeeId() == null || criteria.employeeId().equals(employee.getId()))
                .toList();
        if (candidates.isEmpty()) {
            return List.of();
        }

        int windowYears = settingsService.trainingWindowYears();
        BigDecimal requiredHours = settingsService.globalTrainingHours();
        Map<Long, List<TrainingRecord>> recordsByEmployee = recordsByEmployee(
                candidates,
                asOfDate.minusYears(windowYears),
                asOfDate
        );

        return candidates.stream()
                .map(employee -> summarizeEmployee(
                        employee,
                        asOfDate,
                        recordsByEmployee.getOrDefault(employee.getId(), List.of()),
                        requiredHours,
                        windowYears,
                        criteria.professionalFieldId()
                ))
                .filter(context -> matchesStatusFilters(context.summary(), criteria))
                .toList();
    }

    private record EmployeeStatusContext(
            EmployeeTrainingStatusSummaryResponse summary,
            List<TrainingRecord> windowRecords
    ) {}

    private TrainingDashboardSummaryResponse.Totals dashboardTotals(
            List<EmployeeTrainingStatusSummaryResponse> summaries
    ) {
        long configured = summaries.size();
        long compliant = countStatus(summaries, ComplianceStatus.COMPLIANT);
        BigDecimal averageProgress = configured == 0
                ? BigDecimal.ZERO
                : summaries.stream()
                        .map(EmployeeTrainingStatusSummaryResponse::progressPercentage)
                        .map(this::safe)
                        .reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(configured), 2, RoundingMode.HALF_UP);
        BigDecimal complianceRate = configured == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(compliant)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(configured), 2, RoundingMode.HALF_UP);
        return new TrainingDashboardSummaryResponse.Totals(
                summaries.size(),
                configured,
                countStatus(summaries, ComplianceStatus.NOT_CONFIGURED),
                compliant,
                countStatus(summaries, ComplianceStatus.AT_RISK),
                countStatus(summaries, ComplianceStatus.NON_COMPLIANT),
                sumHours(summaries, EmployeeTrainingStatusSummaryResponse::requiredHours),
                sumHours(summaries, EmployeeTrainingStatusSummaryResponse::submittedHours),
                sumHours(summaries, EmployeeTrainingStatusSummaryResponse::remainingHours),
                averageProgress,
                complianceRate
        );
    }

    private TrainingDashboardSummaryResponse.DepartmentItem departmentDashboardItem(
            List<EmployeeTrainingStatusSummaryResponse> summaries
    ) {
        EmployeeTrainingStatusSummaryResponse first = summaries.get(0);
        TrainingDashboardSummaryResponse.Totals totals = dashboardTotals(summaries);
        return new TrainingDashboardSummaryResponse.DepartmentItem(
                first.departmentId(),
                first.departmentName() == null ? "Chưa xác định" : first.departmentName(),
                totals.employeeCount(),
                totals.configuredCount(),
                totals.notConfiguredCount(),
                totals.compliantCount(),
                totals.atRiskCount(),
                totals.nonCompliantCount(),
                totals.requiredHours(),
                totals.submittedHours(),
                totals.remainingHours(),
                totals.complianceRate()
        );
    }

    private List<ProfessionalFieldHoursItemResponse> professionalFieldDashboardItems(List<TrainingRecord> records) {
        Map<Long, HoursTotals> totals = new LinkedHashMap<>();
        records.forEach(record -> {
            Long fieldId = record.getProfessionalField() == null ? null : record.getProfessionalField().getId();
            String fieldName = record.getProfessionalField() == null
                    ? UNASSIGNED_PROFESSIONAL_FIELD
                    : record.getProfessionalField().getName();
            totals.computeIfAbsent(fieldId, ignored -> new HoursTotals(fieldId, fieldName)).add(record);
        });
        return totals.values()
                .stream()
                .map(total -> new ProfessionalFieldHoursItemResponse(total.id, total.name, total.submittedHours))
                .sorted(Comparator.comparing(
                        ProfessionalFieldHoursItemResponse::professionalFieldName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();
    }

    private List<TrainingStatusActivityTypeHoursResponse> activityTypeDashboardItems(List<TrainingRecord> records) {
        return activityTypeHours(records).stream()
                .sorted(Comparator.comparing(
                        TrainingStatusActivityTypeHoursResponse::activityTypeName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();
    }

    private long countStatus(
            List<EmployeeTrainingStatusSummaryResponse> summaries,
            ComplianceStatus status
    ) {
        return summaries.stream().filter(item -> item.complianceStatus() == status).count();
    }

    private BigDecimal sumHours(
            List<EmployeeTrainingStatusSummaryResponse> summaries,
            Function<EmployeeTrainingStatusSummaryResponse, BigDecimal> extractor
    ) {
        return summaries.stream()
                .map(extractor)
                .map(this::safe)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
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

        return new PersonalTrainingStatusResponse(
                base.employeeId(),
                base.employeeCode(),
                base.employeeName(),
                base.status(),
                base.requiredHours(),
                base.submittedHours(),
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

    private EmployeeStatusContext summarizeEmployee(
            User employee,
            LocalDate asOf,
            List<TrainingRecord> records,
            BigDecimal requiredHours,
            int windowYears,
            Long professionalFieldId
    ) {
        Department department = employee.getDepartment();
        Position position = employee.getPosition();
        LocalDate windowStart = asOf.minusYears(windowYears);
        List<TrainingRecord> windowRecords = records.stream()
                .filter(record -> !record.getStartDate().isBefore(windowStart))
                .filter(record -> !record.getStartDate().isAfter(asOf))
                .filter(record -> professionalFieldId == null
                        || (record.getProfessionalField() != null
                                && professionalFieldId.equals(record.getProfessionalField().getId())))
                .toList();
        BigDecimal submittedHours = sumSubmitted(windowRecords);
        BigDecimal normalizedRequiredHours = safe(requiredHours);
        BigDecimal remainingHours = normalizedRequiredHours.subtract(submittedHours).max(BigDecimal.ZERO);
        BigDecimal progressPercentage = progressPercentage(normalizedRequiredHours, submittedHours);
        ComplianceStatus status = complianceCalculator.resolveStatus(normalizedRequiredHours, submittedHours);
        LocalDate lastTrainingDate = windowRecords.stream()
                .map(TrainingRecord::getStartDate)
                .max(LocalDate::compareTo)
                .orElse(null);

        EmployeeTrainingStatusSummaryResponse summary = new EmployeeTrainingStatusSummaryResponse(
                employee.getId(),
                employee.getEmployeeCode(),
                employee.getName(),
                idOf(department),
                department == null ? null : department.getName(),
                idOf(position),
                position == null ? null : position.getName(),
                null,
                "Mục tiêu giờ đào tạo toàn viện",
                normalizedRequiredHours,
                submittedHours,
                remainingHours,
                progressPercentage,
                windowYears,
                windowStart,
                asOf,
                status,
                lastTrainingDate,
                warningMessage(status, remainingHours)
        );
        return new EmployeeStatusContext(summary, windowRecords);
    }

    private boolean matchesStatusFilters(
            EmployeeTrainingStatusSummaryResponse summary,
            EmployeeTrainingStatusSearchRequest criteria
    ) {
        if (criteria.complianceStatus() != null && summary.complianceStatus() != criteria.complianceStatus()) {
            return false;
        }
        if (criteria.compliant() != null
                && (summary.complianceStatus() == ComplianceStatus.COMPLIANT) != criteria.compliant()) {
            return false;
        }
        if (criteria.submittedHoursMin() != null
                && summary.submittedHours().compareTo(criteria.submittedHoursMin()) < 0) {
            return false;
        }
        if (criteria.submittedHoursMax() != null
                && summary.submittedHours().compareTo(criteria.submittedHoursMax()) > 0) {
            return false;
        }
        // The global training target is configured for every ACTIVE account.
        return criteria.requirementConfigured() == null || criteria.requirementConfigured();
    }

    private List<EmployeeTrainingRecordLedgerResponse> withRunningSubmittedTotals(
            List<EmployeeTrainingRecordLedgerResponse> rows,
            LocalDate asOf,
            int windowYears
    ) {
        BigDecimal running = BigDecimal.ZERO;
        List<EmployeeTrainingRecordLedgerResponse> result = new ArrayList<>();
        for (EmployeeTrainingRecordLedgerResponse row : rows) {
            if (TrainingRecordValidity.countsTowardTotal(
                    row.startDate(), row.workflowStatus(), asOf, windowYears
            )) {
                running = running.add(safe(row.declaredHours()));
            }
            result.add(row.withRunningSubmittedHours(running));
        }
        return result;
    }

    private List<TrainingStatusYearlyHoursResponse> yearlyHours(List<TrainingRecord> records) {
        Map<Integer, BigDecimal> totals = new LinkedHashMap<>();
        records.stream()
                .sorted(Comparator.comparing(TrainingRecord::getStartDate))
                .forEach(record -> totals.merge(
                        record.getStartDate().getYear(),
                        safeSubmittedHours(record),
                        BigDecimal::add
                ));
        return totals.entrySet()
                .stream()
                .map(entry -> new TrainingStatusYearlyHoursResponse(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<TrainingStatusActivityTypeHoursResponse> activityTypeHours(List<TrainingRecord> records) {
        Map<Long, HoursTotals> totals = new LinkedHashMap<>();
        records.forEach(record -> {
            Long activityTypeId = record.getActivityType() == null ? null : record.getActivityType().getId();
            String activityTypeName = record.getActivityType() == null ? null : record.getActivityType().getName();
            totals.computeIfAbsent(activityTypeId, ignored -> new HoursTotals(activityTypeId, activityTypeName))
                    .add(record);
        });
        return totals.values()
                .stream()
                .map(total -> new TrainingStatusActivityTypeHoursResponse(
                        total.id,
                        total.name,
                        total.submittedHours
                ))
                .toList();
    }

    private List<TrainingStatusRecordSummaryResponse> recentRecords(List<TrainingRecord> records) {
        return records.stream()
                .sorted(Comparator.comparing(TrainingRecord::getStartDate).reversed())
                .limit(10)
                .map(this::recordSummary)
                .toList();
    }

    private List<TrainingStatusRecordSummaryResponse> attentionRecords(List<TrainingRecord> records) {
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.CANCELLED)
                .sorted(Comparator.comparing(TrainingRecord::getStartDate).reversed())
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
                record.getWorkflowStatus()
        );
    }

    private BigDecimal sumSubmitted(List<TrainingRecord> records) {
        return records.stream()
                .filter(record -> record.getWorkflowStatus() == TrainingRecordStatus.SUBMITTED)
                .map(TrainingRecord::getDeclaredHours)
                .map(this::safe)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal safeSubmittedHours(TrainingRecord record) {
        if (record.getWorkflowStatus() == TrainingRecordStatus.SUBMITTED) {
            return safe(record.getDeclaredHours());
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal safe(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal progressPercentage(BigDecimal requiredHours, BigDecimal submittedHours) {
        if (requiredHours == null || requiredHours.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.valueOf(100);
        }
        return submittedHours
                .multiply(BigDecimal.valueOf(100))
                .divide(requiredHours, 2, RoundingMode.HALF_UP)
                .min(BigDecimal.valueOf(100));
    }

    private String warningMessage(ComplianceStatus status, BigDecimal remainingHours) {
        return switch (status) {
            case NOT_CONFIGURED -> "No active training requirement is configured";
            case COMPLIANT -> "Training requirement is met";
            case AT_RISK, NON_COMPLIANT -> remainingHours.stripTrailingZeros().toPlainString()
                    + " submitted hours remaining";
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
                case "submittedHours" -> comparingValue(EmployeeTrainingStatusSummaryResponse::submittedHours, order.getDirection());
                case "progressPercentage" -> comparingValue(EmployeeTrainingStatusSummaryResponse::progressPercentage, order.getDirection());
                case "remainingHours" -> comparingValue(EmployeeTrainingStatusSummaryResponse::remainingHours, order.getDirection());
                case "status", "complianceStatus" -> comparingValue(EmployeeTrainingStatusSummaryResponse::complianceStatus, order.getDirection());
                case "lastTrainingDate" -> comparingValue(EmployeeTrainingStatusSummaryResponse::lastTrainingDate, order.getDirection());
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
                case "runningSubmittedHours" -> comparingValue(EmployeeTrainingRecordLedgerResponse::runningSubmittedHours, order.getDirection());
                case "workflowStatus" -> comparingValue(EmployeeTrainingRecordLedgerResponse::workflowStatus, order.getDirection());
                case "sourceType" -> comparingValue(EmployeeTrainingRecordLedgerResponse::sourceType, order.getDirection());
                case "evidenceCount" -> comparingValue(EmployeeTrainingRecordLedgerResponse::evidenceCount, order.getDirection());
                default -> throw new IllegalArgumentException("Thuộc tính sắp xếp hồ sơ đào tạo không được hỗ trợ: " + order.getProperty());
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

    private Year resolveYear(Integer year) {
        int selectedYear = year == null ? Year.now().getValue() : year;
        try {
            return Year.of(selectedYear);
        } catch (DateTimeException exception) {
            throw new BadRequestException("Năm đào tạo không hợp lệ: " + selectedYear);
        }
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

    private static class HoursTotals {
        private final Long id;
        private final String name;
        private BigDecimal submittedHours = BigDecimal.ZERO;

        private HoursTotals(Long id, String name) {
            this.id = id;
            this.name = name;
        }

        private void add(TrainingRecord record) {
            if (record.getWorkflowStatus() == TrainingRecordStatus.SUBMITTED
                    && record.getDeclaredHours() != null) {
                submittedHours = submittedHours.add(record.getDeclaredHours());
            }
        }
    }
}
