package vn.vietduc.carehubbackend.training.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeFormRequest;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeAuditResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeListResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeRecentRecordResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityTypeChangeLog;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;

@Component
public class TrainingActivityTypeMapper {
    public TrainingActivityType toEntity(ActivityTypeFormRequest request) {
        TrainingActivityType entity = new TrainingActivityType();
        applyForm(entity, request);
        return entity;
    }

    public void applyForm(TrainingActivityType entity, ActivityTypeFormRequest request) {
        entity.setCode(normalizeCode(request.code()));
        entity.setName(trim(request.name()));
        entity.setDescription(trim(request.description()));
        entity.setDefaultDurationUnit(request.defaultDurationUnit() == null ? DurationUnit.HOUR : request.defaultDurationUnit());
        entity.setRequiresEvidence(request.requiresEvidence());
        entity.setMaxCreditedHoursPerRecord(request.maxCreditedHoursPerRecord());
        entity.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        entity.setActive(request.active() == null || request.active());
    }

    public ActivityTypeListResponse toListResponse(TrainingActivityType entity, long usageCount) {
        return new ActivityTypeListResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getDescription(),
                entity.getDefaultDurationUnit(),
                entity.isRequiresEvidence(),
                entity.getMaxCreditedHoursPerRecord(),
                usageCount,
                entity.getSortOrder(),
                entity.isActive(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    public ActivityTypeDetailResponse toDetailResponse(
            TrainingActivityType entity,
            long usageCount,
            List<TrainingRecord> recentRecords,
            List<TrainingActivityTypeChangeLog> auditLogs
    ) {
        return new ActivityTypeDetailResponse(
                entity.getId(),
                entity.getCode(),
                entity.getName(),
                entity.getDescription(),
                entity.getDefaultDurationUnit(),
                entity.isRequiresEvidence(),
                entity.getMaxCreditedHoursPerRecord(),
                entity.getSortOrder(),
                entity.isActive(),
                usageCount,
                recentRecords.stream().map(this::toRecentRecordResponse).toList(),
                auditLogs.stream().map(this::toAuditResponse).toList(),
                idOf(entity.getCreatedByUser()),
                idOf(entity.getUpdatedByUser()),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getVersion()
        );
    }

    private Long idOf(User user) {
        return user == null ? null : user.getId();
    }

    private ActivityTypeRecentRecordResponse toRecentRecordResponse(TrainingRecord record) {
        User employee = record.getEmployee();
        return new ActivityTypeRecentRecordResponse(
                record.getId(),
                record.getTitle(),
                idOf(employee),
                employee == null ? null : employee.getEmployeeCode(),
                employee == null ? null : employee.getName(),
                record.getStartDate(),
                record.getDeclaredHours(),
                record.getApprovedHours(),
                record.getWorkflowStatus()
        );
    }

    private ActivityTypeAuditResponse toAuditResponse(TrainingActivityTypeChangeLog log) {
        User changedBy = log.getChangedByUser();
        return new ActivityTypeAuditResponse(
                log.getId(),
                log.getChangeType(),
                idOf(changedBy),
                changedBy == null ? null : changedBy.getName(),
                log.getChangedAt(),
                log.getVersionNo(),
                log.getBeforeData(),
                log.getAfterData()
        );
    }

    private String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase();
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }
}
