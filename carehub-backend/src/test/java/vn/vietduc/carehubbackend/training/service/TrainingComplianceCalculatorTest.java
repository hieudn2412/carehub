package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
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
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * L1 unit tests — sheet {@code TrainingComplianceCalculator}, Test ID prefix {@code L1-TCC}.
 *
 * <p>Note on SRS traceability: BR-05 / FR-023 / NAC-05-01 say only <em>approved</em> hours count
 * toward compliance, but {@link TrainingRecordStatus} has no APPROVED value and both
 * {@code sumSubmittedHours} and {@code TrainingRecordRepository.sumApprovedHoursForEmployee} filter
 * on SUBMITTED. See D1 in docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md — the tests below assert the
 * implemented behaviour and the divergence is tracked separately.
 */
class TrainingComplianceCalculatorTest {
    private static final long DEPARTMENT_ID = 10L;
    private static final long POSITION_ID = 20L;
    private static final LocalDate AS_OF = LocalDate.of(2026, 6, 16);

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
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(Set.of(DEPARTMENT_ID));
        when(cmeScopeService.isApplicable(any(User.class), anySet())).thenAnswer(invocation -> {
            User employee = invocation.getArgument(0);
            Set<Long> departmentIds = invocation.getArgument(1);
            return employee.getDepartment() != null && departmentIds.contains(employee.getDepartment().getId());
        });
    }

    // ── Block: resolveStatus() — BVA on the requiredHours / warningThreshold bands ──

    @ParameterizedTest(name = "submitted={0} → {1}")
    @CsvSource({
            "121, COMPLIANT",      // above required
            "120, COMPLIANT",      // BVA: exactly required — last value that is still compliant
            "119.99, AT_RISK",     // BVA: required - epsilon falls back to the warning band
            "80, AT_RISK",         // BVA: exactly the warning threshold
            "79.99, NON_COMPLIANT",// BVA: warning threshold - epsilon
            "0, NON_COMPLIANT"     // BVA: nothing submitted
    })
    @DisplayName("L1-TCC-01 | BVA: resolveStatus band edges for required=120 / warning=80")
    void resolveStatusCoversEveryBandEdge(BigDecimal submittedHours, ComplianceStatus expected) {
        TrainingRequirement requirement = requirement(BigDecimal.valueOf(120), BigDecimal.valueOf(80));

        assertThat(calculator.resolveStatus(requirement, submittedHours)).isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-TCC-02 | EP-Invalid: resolveStatus with a null requirement → NOT_CONFIGURED")
    void resolveStatusWithNullRequirementIsNotConfigured() {
        assertThat(calculator.resolveStatus(null, BigDecimal.valueOf(500)))
                .isEqualTo(ComplianceStatus.NOT_CONFIGURED);
    }

    @Test
    @DisplayName("L1-TCC-03 | BC-FALSE: warningThreshold null → AT_RISK unreachable, falls to NON_COMPLIANT")
    void missingWarningThresholdSkipsAtRisk() {
        TrainingRequirement requirement = requirement(BigDecimal.valueOf(120), null);

        assertThat(calculator.resolveStatus(requirement, BigDecimal.valueOf(119)))
                .isEqualTo(ComplianceStatus.NON_COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-04 | EP-Invalid: null submittedHours is coerced to 0 → NON_COMPLIANT")
    void nullSubmittedHoursIsTreatedAsZero() {
        TrainingRequirement requirement = requirement(BigDecimal.valueOf(120), BigDecimal.valueOf(80));

        assertThat(calculator.resolveStatus(requirement, null)).isEqualTo(ComplianceStatus.NON_COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-05 | BVA-Min: requiredHours 0 → any submitted total is COMPLIANT")
    void zeroRequiredHoursIsAlwaysCompliant() {
        TrainingRequirement requirement = requirement(BigDecimal.ZERO, null);

        assertThat(calculator.resolveStatus(requirement, BigDecimal.ZERO)).isEqualTo(ComplianceStatus.COMPLIANT);
    }

    // ── Block: sumSubmittedHours() — status partitioning ───────────────────────

    @Test
    @DisplayName("L1-TCC-06 | EP: only SUBMITTED records are summed; DRAFT and CANCELLED ignored")
    void onlySubmittedRecordsAreSummed() {
        BigDecimal total = calculator.sumSubmittedHours(List.of(
                record(TrainingRecordStatus.SUBMITTED, BigDecimal.valueOf(5)),
                record(TrainingRecordStatus.DRAFT, BigDecimal.valueOf(100)),
                record(TrainingRecordStatus.CANCELLED, BigDecimal.valueOf(50))
        ));

        assertThat(total).isEqualByComparingTo("5");
    }

    @Test
    @DisplayName("L1-TCC-07 | BC-TRUE: sumSubmittedHours(null) → 0 without NPE")
    void nullRecordListSumsToZero() {
        assertThat(calculator.sumSubmittedHours(null)).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-TCC-08 | BC-TRUE: sumSubmittedHours(empty list) → 0")
    void emptyRecordListSumsToZero() {
        assertThat(calculator.sumSubmittedHours(List.of())).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-TCC-09 | EP-Invalid: SUBMITTED record with null declaredHours contributes 0")
    void nullDeclaredHoursContributesZero() {
        BigDecimal total = calculator.sumSubmittedHours(List.of(
                record(TrainingRecordStatus.SUBMITTED, null),
                record(TrainingRecordStatus.SUBMITTED, BigDecimal.valueOf(7.5))
        ));

        assertThat(total).isEqualByComparingTo("7.5");
    }

    // ── Block: selectRequirementFromCandidates() — specificity scoring ─────────

    @Test
    @DisplayName("L1-TCC-10 | EP: department-scoped requirement (score 4) beats position-scoped (score 2)")
    void departmentScopeOutranksPositionScope() {
        TrainingRequirement departmentScoped = requirement(1L, department(), null, null, LocalDate.of(2026, 1, 1));
        TrainingRequirement positionScoped = requirement(2L, null, position(), null, LocalDate.of(2026, 1, 1));

        Optional<TrainingRequirement> selected = calculator.selectRequirementFromCandidates(
                employee(), null, List.of(positionScoped, departmentScoped), Set.of(DEPARTMENT_ID));

        assertThat(selected).map(TrainingRequirement::getId).contains(1L);
    }

    @Test
    @DisplayName("L1-TCC-11 | EP: department + position (score 6) beats department only (score 4)")
    void moreSpecificRequirementWins() {
        TrainingRequirement departmentOnly = requirement(1L, department(), null, null, LocalDate.of(2026, 1, 1));
        TrainingRequirement both = requirement(2L, department(), position(), null, LocalDate.of(2026, 1, 1));

        Optional<TrainingRequirement> selected = calculator.selectRequirementFromCandidates(
                employee(), null, List.of(departmentOnly, both), Set.of(DEPARTMENT_ID));

        assertThat(selected).map(TrainingRequirement::getId).contains(2L);
    }

    @Test
    @DisplayName("L1-TCC-12 | EP: equal specificity → latest effectiveFrom wins (tie-break)")
    void equalSpecificityFallsBackToLatestEffectiveFrom() {
        TrainingRequirement older = requirement(1L, department(), null, null, LocalDate.of(2025, 1, 1));
        TrainingRequirement newer = requirement(2L, department(), null, null, LocalDate.of(2026, 1, 1));

        Optional<TrainingRequirement> selected = calculator.selectRequirementFromCandidates(
                employee(), null, List.of(older, newer), Set.of(DEPARTMENT_ID));

        assertThat(selected).map(TrainingRequirement::getId).contains(2L);
    }

    @Test
    @DisplayName("L1-TCC-13 | BC-FALSE: candidate for another department does not match the employee")
    void candidateForAnotherDepartmentIsFilteredOut() {
        TrainingRequirement otherDepartment = requirement(
                1L, Department.builder().id(99L).name("Other").build(), null, null, LocalDate.of(2026, 1, 1));

        Optional<TrainingRequirement> selected = calculator.selectRequirementFromCandidates(
                employee(), null, List.of(otherDepartment), Set.of(DEPARTMENT_ID));

        assertThat(selected).isEmpty();
    }

    @Test
    @DisplayName("L1-TCC-14 | CC: a field-scoped requirement is filtered out unless the query names that field")
    void fieldScopedRequirementRequiresMatchingFieldFilter() {
        ProfessionalField field = ProfessionalField.builder().id(7L).name("Nursing").build();
        TrainingRequirement withField = requirement(1L, null, null, field, LocalDate.of(2026, 1, 1));
        TrainingRequirement withoutField = requirement(2L, null, null, null, LocalDate.of(2025, 1, 1));

        // professionalFieldId == null → matchesEmployee() rejects withField (7.equals(null) is false),
        // so the unscoped requirement is the only candidate left.
        assertThat(calculator.selectRequirementFromCandidates(
                employee(), null, List.of(withField, withoutField), Set.of(DEPARTMENT_ID)))
                .map(TrainingRequirement::getId).contains(2L);

        // professionalFieldId == 7 → withField matches and scores +1, beating the unscoped one.
        assertThat(calculator.selectRequirementFromCandidates(
                employee(), 7L, List.of(withField, withoutField), Set.of(DEPARTMENT_ID)))
                .map(TrainingRequirement::getId).contains(1L);
    }

    @Test
    @DisplayName("L1-TCC-15 | BC-FALSE: field-scoped requirement is skipped when the query names another field")
    void fieldScopedRequirementIsSkippedForAnotherField() {
        ProfessionalField field = ProfessionalField.builder().id(7L).name("Nursing").build();
        TrainingRequirement withField = requirement(1L, null, null, field, LocalDate.of(2026, 1, 1));

        assertThat(calculator.selectRequirementFromCandidates(
                employee(), 8L, List.of(withField), Set.of(DEPARTMENT_ID)))
                .isEmpty();
    }

    @Test
    @DisplayName("L1-TCC-16 | Guard-FALSE: employee outside the CME scope → no requirement selected")
    void employeeOutsideScopeSelectsNothing() {
        TrainingRequirement candidate = requirement(1L, department(), null, null, LocalDate.of(2026, 1, 1));

        Optional<TrainingRequirement> selected = calculator.selectRequirementFromCandidates(
                employee(), null, List.of(candidate), Set.of(999L));

        assertThat(selected).isEmpty();
    }

    // ── Block: calculate() — end-to-end status assembly ────────────────────────

    @Test
    @DisplayName("L1-TCC-17 | Guard-FALSE: department outside CME scope → NOT_CONFIGURED with scope message")
    void employeeOutsideConfiguredDepartmentsIsNotConfigured() {
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(Set.of(999L));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.NOT_CONFIGURED);
        assertThat(status.requirementId()).isNull();
        assertThat(status.warningMessage()).contains("not configured");
    }

    @Test
    @DisplayName("L1-TCC-18 | BC-TRUE: no active requirement → NOT_CONFIGURED, zeroed totals")
    void missingRequirementReturnsNotConfigured() {
        when(requirementRepository.findActiveCandidates(
                eq(DEPARTMENT_ID), eq(POSITION_ID), eq(null), any(LocalDate.class)))
                .thenReturn(List.of());

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.NOT_CONFIGURED);
        assertThat(status.requirementId()).isNull();
        assertThat(status.requiredHours()).isEqualByComparingTo("0");
        assertThat(status.progressPercentage()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-TCC-19 | State-Valid: window start = asOf minus cycleYears; remaining and progress derived")
    void calculateDerivesWindowRemainingAndProgress() {
        TrainingRequirement requirement = requirement(1L, department(), null, null, LocalDate.of(2020, 1, 1));
        requirement.setRequiredHours(BigDecimal.valueOf(120));
        requirement.setWarningThresholdHours(BigDecimal.valueOf(80));
        requirement.setCycleYears(5);
        requirement.setName("CME 5 năm");
        when(requirementRepository.findActiveCandidates(
                eq(DEPARTMENT_ID), eq(POSITION_ID), eq(null), any(LocalDate.class)))
                .thenReturn(List.of(requirement));
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(BigDecimal.valueOf(90));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.AT_RISK);
        assertThat(status.windowStart()).isEqualTo(LocalDate.of(2021, 6, 16));
        assertThat(status.windowEnd()).isEqualTo(AS_OF);
        assertThat(status.requiredHours()).isEqualByComparingTo("120");
        assertThat(status.submittedHours()).isEqualByComparingTo("90");
        assertThat(status.remainingHours()).isEqualByComparingTo("30");
        assertThat(status.progressPercentage()).isEqualByComparingTo("75.00");
        assertThat(status.warningMessage()).isEqualTo("30 giờ còn thiếu");
    }

    @Test
    @DisplayName("L1-TCC-20 | BVA-Max: submitted above required → remaining floored at 0, progress capped at 100")
    void overAchievementIsClampedAtZeroRemainingAndHundredPercent() {
        TrainingRequirement requirement = requirement(1L, department(), null, null, LocalDate.of(2020, 1, 1));
        requirement.setRequiredHours(BigDecimal.valueOf(120));
        requirement.setCycleYears(5);
        when(requirementRepository.findActiveCandidates(
                eq(DEPARTMENT_ID), eq(POSITION_ID), eq(null), any(LocalDate.class)))
                .thenReturn(List.of(requirement));
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(BigDecimal.valueOf(200));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.COMPLIANT);
        assertThat(status.remainingHours()).isEqualByComparingTo("0");
        assertThat(status.progressPercentage()).isEqualByComparingTo("100");
        assertThat(status.warningMessage()).isEqualTo("Training requirement is met");
    }

    @Test
    @DisplayName("L1-TCC-21 | BVA-Min: requiredHours 0 → progress is 100% instead of dividing by zero")
    void zeroRequiredHoursYieldsHundredPercentProgress() {
        TrainingRequirement requirement = requirement(1L, department(), null, null, LocalDate.of(2020, 1, 1));
        requirement.setRequiredHours(BigDecimal.ZERO);
        requirement.setCycleYears(5);
        when(requirementRepository.findActiveCandidates(
                eq(DEPARTMENT_ID), eq(POSITION_ID), eq(null), any(LocalDate.class)))
                .thenReturn(List.of(requirement));
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(BigDecimal.ZERO);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.progressPercentage()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("L1-TCC-22 | EP-Invalid: asOf null → window end defaults to today")
    void nullAsOfDefaultsToToday() {
        when(cmeScopeService.getApplicableDepartmentIds()).thenReturn(Set.of(999L));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, null);

        assertThat(status.windowEnd()).isEqualTo(LocalDate.now());
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private static Department department() {
        return Department.builder().id(DEPARTMENT_ID).name("ICU").build();
    }

    private static Position position() {
        return Position.builder().id(POSITION_ID).name("Doctor").build();
    }

    private static User employee() {
        return User.builder()
                .id(1L)
                .employeeCode("VD001")
                .name("Employee")
                .password("password")
                .department(department())
                .position(position())
                .build();
    }

    private static TrainingRecord record(TrainingRecordStatus status, BigDecimal declaredHours) {
        return TrainingRecord.builder()
                .workflowStatus(status)
                .declaredHours(declaredHours)
                .build();
    }

    private static TrainingRequirement requirement(BigDecimal requiredHours, BigDecimal warningThresholdHours) {
        return TrainingRequirement.builder()
                .requiredHours(requiredHours)
                .warningThresholdHours(warningThresholdHours)
                .build();
    }

    private static TrainingRequirement requirement(
            Long id,
            Department department,
            Position jobPosition,
            ProfessionalField professionalField,
            LocalDate effectiveFrom
    ) {
        TrainingRequirement requirement = TrainingRequirement.builder()
                .requiredHours(BigDecimal.valueOf(120))
                .cycleYears(5)
                .department(department)
                .jobPosition(jobPosition)
                .professionalField(professionalField)
                .effectiveFrom(effectiveFrom)
                .build();
        requirement.setId(id);
        return requirement;
    }
}
