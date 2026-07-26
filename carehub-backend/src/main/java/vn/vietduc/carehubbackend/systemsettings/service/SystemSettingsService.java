package vn.vietduc.carehubbackend.systemsettings.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.systemsettings.dto.SystemSettingsRequest;
import vn.vietduc.carehubbackend.systemsettings.dto.SystemSettingsResponse;
import vn.vietduc.carehubbackend.systemsettings.entity.SystemSetting;
import vn.vietduc.carehubbackend.systemsettings.repository.SystemSettingRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class SystemSettingsService {
    private final SystemSettingRepository repository;

    @Transactional
    public SystemSettingsResponse get() {
        return toResponse(getOrCreate());
    }

    @Transactional
    public SystemSettingsResponse update(SystemSettingsRequest request) {
        SystemSetting setting = getOrCreate();
        if (request.version() != null && !request.version().equals(setting.getLockVersion())) {
            throw new ConflictException("Cấu hình hệ thống đã được cập nhật bởi người khác");
        }
        setting.setGlobalTrainingHours(normalize(request.globalTrainingHours()));
        return toResponse(repository.saveAndFlush(setting));
    }

    @Transactional(readOnly = true)
    public BigDecimal globalTrainingHours() {
        return repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .map(SystemSetting::getGlobalTrainingHours)
                .orElse(SystemSetting.DEFAULT_TRAINING_HOURS);
    }

    public int trainingWindowYears() {
        return SystemSetting.TRAINING_WINDOW_YEARS;
    }

    private SystemSetting getOrCreate() {
        return repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .orElseGet(() -> repository.saveAndFlush(SystemSetting.builder()
                        .scopeKey(SystemSetting.GLOBAL_SCOPE)
                        .globalTrainingHours(SystemSetting.DEFAULT_TRAINING_HOURS)
                        .build()));
    }

    private BigDecimal normalize(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private SystemSettingsResponse toResponse(SystemSetting setting) {
        return new SystemSettingsResponse(
                setting.getGlobalTrainingHours(),
                SystemSetting.TRAINING_WINDOW_YEARS,
                setting.getLockVersion(),
                setting.getUpdatedAt()
        );
    }
}
