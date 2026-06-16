package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ActivityTypeListResponse(
        Long id,
        String code,
        String name,
        String description,
        DurationUnit defaultDurationUnit,
        boolean requiresEvidence,
        BigDecimal maxCreditedHoursPerRecord,
        long usageCount,
        int sortOrder,
        boolean active,
        LocalDateTime updatedAt,
        Long version
) {
}
