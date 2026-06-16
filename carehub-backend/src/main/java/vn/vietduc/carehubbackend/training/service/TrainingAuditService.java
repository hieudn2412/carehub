package vn.vietduc.carehubbackend.training.service;

import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.Map;

public interface TrainingAuditService {
    void logRecordChange(
            TrainingRecord record,
            TrainingRecordChangeType changeType,
            Map<String, Object> beforeData,
            Map<String, Object> afterData,
            User changedBy
    );
}
