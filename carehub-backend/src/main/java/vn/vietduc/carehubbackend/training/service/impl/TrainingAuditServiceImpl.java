package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordChangeLogRepository;
import vn.vietduc.carehubbackend.training.service.TrainingAuditService;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TrainingAuditServiceImpl implements TrainingAuditService {
    private final TrainingRecordChangeLogRepository changeLogRepository;

    @Override
    @Transactional
    public void logRecordChange(
            TrainingRecord record,
            TrainingRecordChangeType changeType,
            Map<String, Object> beforeData,
            Map<String, Object> afterData,
            User changedBy
    ) {
        TrainingRecordChangeLog log = TrainingRecordChangeLog.builder()
                .trainingRecord(record)
                .versionNo(record.getVersion() == null ? 0 : record.getVersion())
                .changeType(changeType)
                .beforeData(beforeData)
                .afterData(afterData)
                .changedByUser(changedBy)
                .changedAt(LocalDateTime.now())
                .build();
        changeLogRepository.save(log);
    }
}
