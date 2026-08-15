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
        if (request.trainingWindowYears() != null) {
            setting.setTrainingWindowYears(request.trainingWindowYears());
        }
        setting.setCompetencyTargetScore(normalize(request.competencyTargetScore()));
        return toResponse(repository.saveAndFlush(setting));
    }

    @Transactional(readOnly = true)
    public BigDecimal globalTrainingHours() {
        return repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .map(SystemSetting::getGlobalTrainingHours)
                .orElse(SystemSetting.DEFAULT_TRAINING_HOURS);
    }

    @Transactional(readOnly = true)
    public int trainingWindowYears() {
        return repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .map(SystemSetting::getTrainingWindowYears)
                .filter(years -> years > 0)
                .orElse(SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS);
    }

    @Transactional(readOnly = true)
    public BigDecimal competencyTargetScore() {
        return repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .map(SystemSetting::getCompetencyTargetScore)
                .filter(score -> score.compareTo(BigDecimal.ZERO) >= 0
                        && score.compareTo(BigDecimal.TEN) <= 0)
                .orElse(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE);
    }

    private SystemSetting getOrCreate() {
        SystemSetting setting = repository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .orElseGet(() -> repository.saveAndFlush(SystemSetting.builder()
                        .scopeKey(SystemSetting.GLOBAL_SCOPE)
                        .globalTrainingHours(SystemSetting.DEFAULT_TRAINING_HOURS)
                        .trainingWindowYears(SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS)
                        .competencyTargetScore(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE)
                        .build()));
        if (setting.getTrainingWindowYears() == null || setting.getTrainingWindowYears() <= 0) {
            setting.setTrainingWindowYears(SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS);
        }
        if (setting.getCompetencyTargetScore() == null) {
            setting.setCompetencyTargetScore(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE);
        }
        return setting;
    }

    private BigDecimal normalize(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private SystemSettingsResponse toResponse(SystemSetting setting) {
        return new SystemSettingsResponse(
                setting.getGlobalTrainingHours(),
                validTrainingWindowYears(setting),
                validCompetencyTargetScore(setting),
                setting.getLockVersion(),
                setting.getUpdatedAt()
        );
    }

    private int validTrainingWindowYears(SystemSetting setting) {
        Integer years = setting.getTrainingWindowYears();
        return years != null && years > 0
                ? years
                : SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS;
    }

    private BigDecimal validCompetencyTargetScore(SystemSetting setting) {
        BigDecimal score = setting.getCompetencyTargetScore();
        return score != null && score.compareTo(BigDecimal.ZERO) >= 0
                && score.compareTo(BigDecimal.TEN) <= 0
                ? score
                : SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE;
    }
}
