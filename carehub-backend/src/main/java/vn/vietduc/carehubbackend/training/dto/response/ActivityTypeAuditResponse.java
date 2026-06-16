package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingActivityTypeChangeType;

import java.time.LocalDateTime;
import java.util.Map;

public record ActivityTypeAuditResponse(
        Long id,
        TrainingActivityTypeChangeType changeType,
        Long changedByUserId,
        String changedByName,
        LocalDateTime changedAt,
        Long versionNo,
        Map<String, Object> beforeData,
        Map<String, Object> afterData
) {
}
