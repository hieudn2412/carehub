package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * L1 unit tests — sheet {@code TrainingComplianceCalculator}, Test ID prefix {@code L1-TCC}.
 *
 * <p><b>Rebuilt after merging origin/main</b>, which redesigned this class: the per
 * department/position/field {@code TrainingRequirement} lookup and {@code CmeScopeService} are gone,
 * replaced by a single hospital-wide target read from {@link SystemSettingsService}
 * ({@code globalTrainingHours()} / {@code trainingWindowYears()}). Consequences for coverage:
 * <ul>
 *   <li>{@code resolveStatus} now takes two BigDecimals and can only return COMPLIANT or
 *       NON_COMPLIANT — <b>AT_RISK and NOT_CONFIGURED are no longer reachable from this class</b>
 *       ({@code L1-TCC-06} pins that).</li>
 *   <li>The requirement-selection specificity scoring (old L1-TCC-10…16) no longer exists.</li>
 * </ul>
 *
 * <p>SRS traceability caveat: BR-05 / FR-023 / NAC-05-01 say only <em>approved</em> hours count, but
 * {@link TrainingRecordStatus} has no APPROVED value and both {@code sumSubmittedHours} and
 * {@code TrainingRecordRepository.sumApprovedHoursForEmployee} filter on SUBMITTED — see D1 in
 * docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md.
 */
class TrainingComplianceCalculatorTest {
    private static final LocalDate AS_OF = LocalDate.of(2026, 7, 26);
    private static final int WINDOW_YEARS = 5;

    private final TrainingRecordRepository recordRepository = mock(TrainingRecordRepository.class);
    private final SystemSettingsService settingsService = mock(SystemSettingsService.class);
    private final TrainingComplianceCalculator calculator =
            new TrainingComplianceCalculator(recordRepository, settingsService);

    @BeforeEach
    void setUpSettings() {
        when(settingsService.trainingWindowYears()).thenReturn(WINDOW_YEARS);
        when(settingsService.globalTrainingHours()).thenReturn(new BigDecimal("120"));
    }

    // ── Block: resolveStatus() — BVA on the single global target ──────────────

    @ParameterizedTest(name = "required=120, submitted={0} → {1}")
    @CsvSource({
            "121,    COMPLIANT",      // above the target
            "120,    COMPLIANT",      // BVA-Max: exactly the target — inclusive
            "119.99, NON_COMPLIANT",  // BVA-Max-1: one hundredth short
            "0,      NON_COMPLIANT"   // nothing submitted
    })
    @DisplayName("L1-TCC-01 | BVA: resolveStatus flips at exactly the global target")
    void resolveStatusFlipsAtTheTarget(BigDecimal submittedHours, ComplianceStatus expected) {
        assertThat(calculator.resolveStatus(new BigDecimal("120"), submittedHours)).isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-TCC-02 | EP-Invalid: null requiredHours is coerced to 0 → COMPLIANT")
    void nullRequiredHoursIsTreatedAsZero() {
        assertThat(calculator.resolveStatus(null, BigDecimal.ZERO)).isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-03 | EP-Invalid: null submittedHours is coerced to 0 → NON_COMPLIANT")
    void nullSubmittedHoursIsTreatedAsZero() {
        assertThat(calculator.resolveStatus(new BigDecimal("120"), null))
                .isEqualTo(ComplianceStatus.NON_COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-04 | EP-Invalid: both arguments null → COMPLIANT (0 >= 0)")
    void bothArgumentsNullIsCompliant() {
        assertThat(calculator.resolveStatus(null, null)).isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-05 | BVA-Min: requiredHours 0 → any submitted total is COMPLIANT")
    void zeroRequiredHoursIsAlwaysCompliant() {
        assertThat(calculator.resolveStatus(BigDecimal.ZERO, BigDecimal.ZERO))
                .isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-06 | EP: resolveStatus can only yield COMPLIANT or NON_COMPLIANT")
    void resolveStatusOnlyYieldsTwoStatuses() {
        // The AT_RISK / NOT_CONFIGURED branches disappeared with the per-requirement model; this
        // pins the reduced partition so a reintroduced warning band cannot slip in untested.
        for (String submitted : new String[]{"0", "0.01", "60", "119.99", "120", "500"}) {
            assertThat(calculator.resolveStatus(new BigDecimal("120"), new BigDecimal(submitted)))
                    .as("submitted=%s", submitted)
                    .isIn(ComplianceStatus.COMPLIANT, ComplianceStatus.NON_COMPLIANT);
        }
    }

    // ── Block: sumSubmittedHours() — status partitioning ───────────────────────

    @Test
    @DisplayName("L1-TCC-07 | EP: only SUBMITTED records are summed; DRAFT and CANCELLED ignored")
    void onlySubmittedRecordsAreSummed() {
        BigDecimal total = calculator.sumSubmittedHours(List.of(
                record(TrainingRecordStatus.SUBMITTED, new BigDecimal("5")),
                record(TrainingRecordStatus.DRAFT, new BigDecimal("100")),
                record(TrainingRecordStatus.CANCELLED, new BigDecimal("50"))
        ));

        assertThat(total).isEqualByComparingTo("5");
    }

    @Test
    @DisplayName("L1-TCC-08 | BC-TRUE: sumSubmittedHours(null) → 0 without NPE")
    void nullRecordListSumsToZero() {
        assertThat(calculator.sumSubmittedHours(null)).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-TCC-09 | BC-TRUE: sumSubmittedHours(empty list) → 0")
    void emptyRecordListSumsToZero() {
        assertThat(calculator.sumSubmittedHours(List.of())).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-TCC-10 | EP-Invalid: SUBMITTED record with null declaredHours contributes 0")
    void nullDeclaredHoursContributesZero() {
        BigDecimal total = calculator.sumSubmittedHours(List.of(
                record(TrainingRecordStatus.SUBMITTED, null),
                record(TrainingRecordStatus.SUBMITTED, new BigDecimal("7.5"))
        ));

        assertThat(total).isEqualByComparingTo("7.5");
    }

    // ── Block: calculate() — settings-driven window and totals ────────────────

    @Test
    @DisplayName("L1-TCC-11 | State-Valid: window start = asOf minus the configured window; shortfall derived")
    void calculateDerivesWindowRemainingAndProgress() {
        when(recordRepository.sumApprovedHoursForEmployee(
                eq(1L), eq(AS_OF.minusYears(WINDOW_YEARS)), eq(AS_OF)))
                .thenReturn(new BigDecimal("90"));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.NON_COMPLIANT);
        assertThat(status.windowStart()).isEqualTo(LocalDate.of(2021, 7, 26));
        assertThat(status.windowEnd()).isEqualTo(AS_OF);
        assertThat(status.cycleYears()).isEqualTo(WINDOW_YEARS);
        assertThat(status.requiredHours()).isEqualByComparingTo("120");
        assertThat(status.submittedHours()).isEqualByComparingTo("90");
        assertThat(status.remainingHours()).isEqualByComparingTo("30");
        assertThat(status.progressPercentage()).isEqualByComparingTo("75.00");
        assertThat(status.warningMessage()).isEqualTo("30 giờ còn thiếu");
    }

    @Test
    @DisplayName("L1-TCC-12 | BVA-Max: submitted equals the target → COMPLIANT with the met message")
    void meetingTheTargetIsCompliant() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(new BigDecimal("120"));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.COMPLIANT);
        assertThat(status.remainingHours()).isEqualByComparingTo("0");
        assertThat(status.progressPercentage()).isEqualByComparingTo("100.00");
        assertThat(status.warningMessage()).isEqualTo("Đã đạt mục tiêu giờ đào tạo");
    }

    @Test
    @DisplayName("L1-TCC-13 | BVA-Max+1: over-achievement floors remaining at 0 and caps progress at 100")
    void overAchievementIsClamped() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(new BigDecimal("200"));

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.status()).isEqualTo(ComplianceStatus.COMPLIANT);
        assertThat(status.remainingHours()).isEqualByComparingTo("0");
        assertThat(status.progressPercentage()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("L1-TCC-14 | BVA-Min: global target 0 → progress is 100% instead of dividing by zero")
    void zeroTargetYieldsHundredPercentProgress() {
        when(settingsService.globalTrainingHours()).thenReturn(BigDecimal.ZERO);
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.progressPercentage()).isEqualByComparingTo("100");
        assertThat(status.status()).isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-15 | EP-Invalid: a null global target is coerced to 0 → COMPLIANT, no NPE")
    void nullGlobalTargetIsCoercedToZero() {
        when(settingsService.globalTrainingHours()).thenReturn(null);
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.requiredHours()).isEqualByComparingTo("0");
        assertThat(status.status()).isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    @DisplayName("L1-TCC-16 | EP-Invalid: a null repository total is coerced to 0 → NON_COMPLIANT")
    void nullRepositoryTotalIsCoercedToZero() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any())).thenReturn(null);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.submittedHours()).isEqualByComparingTo("0");
        assertThat(status.status()).isEqualTo(ComplianceStatus.NON_COMPLIANT);
        assertThat(status.remainingHours()).isEqualByComparingTo("120");
    }

    @Test
    @DisplayName("L1-TCC-17 | EP-Invalid: asOf null → window end defaults to today")
    void nullAsOfDefaultsToToday() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, null);

        assertThat(status.windowEnd()).isEqualTo(LocalDate.now());
        assertThat(status.windowStart()).isEqualTo(LocalDate.now().minusYears(WINDOW_YEARS));
    }

    @ParameterizedTest(name = "trainingWindowYears={0}")
    @CsvSource({"1", "3", "5", "10"})
    @DisplayName("L1-TCC-18 | BVA: the lookback window follows trainingWindowYears exactly")
    void windowFollowsConfiguredYears(int years) {
        when(settingsService.trainingWindowYears()).thenReturn(years);
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.cycleYears()).isEqualTo(years);
        assertThat(status.windowStart()).isEqualTo(AS_OF.minusYears(years));
    }

    @Test
    @DisplayName("L1-TCC-19 | State: the response carries the hospital-wide label and no requirement id")
    void responseCarriesGlobalTargetIdentity() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        PersonalTrainingStatusResponse status = calculator.calculate(employee(), null, AS_OF);

        assertThat(status.requirementId()).isNull();
        assertThat(status.requirementName()).isEqualTo("Mục tiêu giờ đào tạo toàn viện");
        assertThat(status.employeeId()).isEqualTo(1L);
        assertThat(status.employeeCode()).isEqualTo("VD001");
        assertThat(status.employeeName()).isEqualTo("Employee");
    }

    @Test
    @DisplayName("L1-TCC-20 | EP: the 4-arg overload ignores the department scope and delegates")
    void fourArgOverloadDelegatesToTheGlobalCalculation() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(new BigDecimal("90"));

        PersonalTrainingStatusResponse global = calculator.calculate(employee(), null, AS_OF);
        PersonalTrainingStatusResponse scoped = calculator.calculate(employee(), 7L, AS_OF, Set.of(999L));

        assertThat(scoped).isEqualTo(global);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private static User employee() {
        return User.builder()
                .id(1L)
                .employeeCode("VD001")
                .name("Employee")
                .password("password")
                .build();
    }

    private static TrainingRecord record(TrainingRecordStatus status, BigDecimal declaredHours) {
        return TrainingRecord.builder()
                .workflowStatus(status)
                .declaredHours(declaredHours)
                .build();
    }
}
