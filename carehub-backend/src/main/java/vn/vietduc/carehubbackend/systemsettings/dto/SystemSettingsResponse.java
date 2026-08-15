package vn.vietduc.carehubbackend.systemsettings.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SystemSettingsResponse(
        BigDecimal globalTrainingHours,
        int trainingWindowYears,
        BigDecimal competencyTargetScore,
        Long version,
        LocalDateTime updatedAt
) {
}
