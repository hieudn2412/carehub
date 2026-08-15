package vn.vietduc.carehubbackend.systemsettings.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.systemsettings.dto.SystemSettingsRequest;
import vn.vietduc.carehubbackend.systemsettings.entity.SystemSetting;
import vn.vietduc.carehubbackend.systemsettings.repository.SystemSettingRepository;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

class SystemSettingsServiceTest {
    private final SystemSettingRepository repository = mock(SystemSettingRepository.class);
    private final SystemSettingsService service = new SystemSettingsService(repository);

    @Test
    void globalTrainingHoursReturnsDefaultWithoutWritingWhenSettingIsMissing() {
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.empty());

        BigDecimal result = service.globalTrainingHours();

        assertThat(result).isEqualByComparingTo(SystemSetting.DEFAULT_TRAINING_HOURS);
        verify(repository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any(SystemSetting.class));
    }

    @Test
    void globalTrainingHoursReturnsConfiguredValue() {
        SystemSetting setting = SystemSetting.builder()
                .scopeKey(SystemSetting.GLOBAL_SCOPE)
                .globalTrainingHours(new BigDecimal("150"))
                .trainingWindowYears(7)
                .competencyTargetScore(new BigDecimal("7.50"))
                .build();
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.of(setting));

        assertThat(service.globalTrainingHours()).isEqualByComparingTo("150");
    }

    @Test
    void trainingWindowYearsReturnsDefaultWithoutWritingWhenSettingIsMissing() {
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.empty());

        assertThat(service.trainingWindowYears()).isEqualTo(SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS);
        verify(repository, never()).saveAndFlush(org.mockito.ArgumentMatchers.any(SystemSetting.class));
    }

    @Test
    void trainingWindowYearsReturnsConfiguredValue() {
        SystemSetting setting = SystemSetting.builder()
                .scopeKey(SystemSetting.GLOBAL_SCOPE)
                .globalTrainingHours(SystemSetting.DEFAULT_TRAINING_HOURS)
                .trainingWindowYears(8)
                .competencyTargetScore(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE)
                .build();
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.of(setting));

        assertThat(service.trainingWindowYears()).isEqualTo(8);
    }

    @Test
    void updatePersistsTrainingHoursAndWindowYearsTogether() {
        SystemSetting setting = SystemSetting.builder()
                .scopeKey(SystemSetting.GLOBAL_SCOPE)
                .globalTrainingHours(SystemSetting.DEFAULT_TRAINING_HOURS)
                .trainingWindowYears(SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS)
                .competencyTargetScore(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE)
                .lockVersion(3L)
                .build();
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.of(setting));
        when(repository.saveAndFlush(any(SystemSetting.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.update(new SystemSettingsRequest(
                new BigDecimal("150"), 7, new BigDecimal("7.50"), 3L));

        assertThat(response.globalTrainingHours()).isEqualByComparingTo("150.00");
        assertThat(response.trainingWindowYears()).isEqualTo(7);
        assertThat(response.competencyTargetScore()).isEqualByComparingTo("7.50");
        assertThat(setting.getTrainingWindowYears()).isEqualTo(7);
        assertThat(setting.getCompetencyTargetScore()).isEqualByComparingTo("7.50");
        verify(repository).saveAndFlush(setting);
    }

    @Test
    void competencyTargetScoreReturnsHospitalDefaultWhenSettingIsMissing() {
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.empty());

        assertThat(service.competencyTargetScore())
                .isEqualByComparingTo(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE);
        verify(repository, never()).saveAndFlush(any(SystemSetting.class));
    }
}
