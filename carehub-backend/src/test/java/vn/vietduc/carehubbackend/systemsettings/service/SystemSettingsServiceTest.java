package vn.vietduc.carehubbackend.systemsettings.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.systemsettings.entity.SystemSetting;
import vn.vietduc.carehubbackend.systemsettings.repository.SystemSettingRepository;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
                .build();
        when(repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)).thenReturn(Optional.of(setting));

        assertThat(service.globalTrainingHours()).isEqualByComparingTo("150");
    }
}
