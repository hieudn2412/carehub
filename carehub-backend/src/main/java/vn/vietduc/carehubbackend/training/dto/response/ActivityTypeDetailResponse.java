package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ActivityTypeDetailResponse(
        Long id,
        String code,
        String name,
        String description,
        DurationUnit defaultDurationUnit,
        boolean requiresEvidence,
        BigDecimal maxCreditedHoursPerRecord,
        int sortOrder,
        boolean active,
        long usageCount,
        List<ActivityTypeRecentRecordResponse> recentRecords,
        List<ActivityTypeAuditResponse> auditTimeline,
        Long createdByUserId,
        Long updatedByUserId,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long version
) {
}
