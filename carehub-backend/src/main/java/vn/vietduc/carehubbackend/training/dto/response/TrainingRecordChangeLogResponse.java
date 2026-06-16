package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;

import java.time.LocalDateTime;
import java.util.Map;

public record TrainingRecordChangeLogResponse(
        Long id,
        Long versionNo,
        TrainingRecordChangeType changeType,
        Map<String, Object> beforeData,
        Map<String, Object> afterData,
        Long changedByUserId,
        String changedByUserName,
        LocalDateTime changedAt
) {
}
