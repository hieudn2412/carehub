package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class TrainingComplianceCalculatorTest {
    private final TrainingRecordRepository recordRepository = mock(TrainingRecordRepository.class);
    private final SystemSettingsService settingsService = mock(SystemSettingsService.class);
    private final TrainingComplianceCalculator calculator = new TrainingComplianceCalculator(recordRepository, settingsService);

    @BeforeEach
    void setUp() {
        when(settingsService.trainingWindowYears()).thenReturn(5);
        when(settingsService.globalTrainingHours()).thenReturn(new BigDecimal("120"));
    }

    @Test
    void usesGlobalFiveYearTargetAndReturnsNonCompliant() {
        User employee = employee();
        LocalDate asOf = LocalDate.of(2026, 7, 26);
        when(recordRepository.sumApprovedHoursForEmployee(1L, asOf.minusYears(5), asOf))
                .thenReturn(new BigDecimal("80"));

        var status = calculator.calculate(employee, null, asOf);

        assertThat(status.status()).isEqualTo(ComplianceStatus.NON_COMPLIANT);
        assertThat(status.requiredHours()).isEqualByComparingTo("120");
        assertThat(status.remainingHours()).isEqualByComparingTo("40");
        assertThat(status.windowStart()).isEqualTo(LocalDate.of(2021, 7, 26));
    }

    @Test
    void compliantWhenSubmittedHoursMeetGlobalTarget() {
        when(recordRepository.sumApprovedHoursForEmployee(anyLong(), any(), any()))
                .thenReturn(new BigDecimal("120"));
        assertThat(calculator.calculate(employee(), null, LocalDate.of(2026, 7, 26)).status())
                .isEqualTo(ComplianceStatus.COMPLIANT);
    }

    @Test
    void onlySubmittedRecordsAreSummed() {
        TrainingRecord submitted = TrainingRecord.builder().workflowStatus(TrainingRecordStatus.SUBMITTED)
                .declaredHours(new BigDecimal("5")).build();
        TrainingRecord draft = TrainingRecord.builder().workflowStatus(TrainingRecordStatus.DRAFT)
                .declaredHours(new BigDecimal("100")).build();
        assertThat(calculator.sumSubmittedHours(List.of(submitted, draft))).isEqualByComparingTo("5");
    }

    @Test
    void resolveStatusOnlyReturnsTwoBusinessStatuses() {
        assertThat(calculator.resolveStatus(new BigDecimal("120"), new BigDecimal("119.5")))
                .isEqualTo(ComplianceStatus.NON_COMPLIANT);
        assertThat(calculator.resolveStatus(new BigDecimal("120"), new BigDecimal("120")))
                .isEqualTo(ComplianceStatus.COMPLIANT);
    }

    private User employee() {
        return User.builder().id(1L).employeeCode("VD001").name("Employee").password("password").build();
    }
}
