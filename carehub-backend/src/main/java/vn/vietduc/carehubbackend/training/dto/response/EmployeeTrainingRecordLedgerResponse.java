package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record EmployeeTrainingRecordLedgerResponse(
        Long id,
        String title,
        String provider,
        Long activityTypeId,
        String activityTypeName,
        Long professionalFieldId,
        String professionalFieldName,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal declaredHours,
        BigDecimal runningSubmittedHours,
        TrainingRecordStatus workflowStatus,
        TrainingSourceType sourceType,
        String sourceReference,
        LocalDateTime sourceSubmittedAt,
        long evidenceCount,
        long passedEvidenceCount,
        long failedEvidenceCount,
        long changeLogCount,
        Long version,
        LocalDate validUntil,
        boolean expired
) {
    public EmployeeTrainingRecordLedgerResponse(
            Long id,
            String title,
            String provider,
            Long activityTypeId,
            String activityTypeName,
            Long professionalFieldId,
            String professionalFieldName,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal declaredHours,
            BigDecimal runningSubmittedHours,
            TrainingRecordStatus workflowStatus,
            TrainingSourceType sourceType,
            String sourceReference,
            LocalDateTime sourceSubmittedAt,
            long evidenceCount,
            long passedEvidenceCount,
            long failedEvidenceCount,
            long changeLogCount,
            Long version
    ) {
        this(id, title, provider, activityTypeId, activityTypeName, professionalFieldId,
                professionalFieldName, startDate, endDate, declaredHours,
                runningSubmittedHours, workflowStatus, sourceType, sourceReference,
                sourceSubmittedAt, evidenceCount, passedEvidenceCount, failedEvidenceCount,
                changeLogCount, version, null, false);
    }

    public EmployeeTrainingRecordLedgerResponse withRunningSubmittedHours(BigDecimal nextRunningSubmittedHours) {
        return new EmployeeTrainingRecordLedgerResponse(
                id,
                title,
                provider,
                activityTypeId,
                activityTypeName,
                professionalFieldId,
                professionalFieldName,
                startDate,
                endDate,
                declaredHours,
                nextRunningSubmittedHours,
                workflowStatus,
                sourceType,
                sourceReference,
                sourceSubmittedAt,
                evidenceCount,
                passedEvidenceCount,
                failedEvidenceCount,
                changeLogCount,
                version,
                validUntil,
                expired
        );
    }

    public EmployeeTrainingRecordLedgerResponse withValidity(LocalDate nextValidUntil, boolean nextExpired) {
        return new EmployeeTrainingRecordLedgerResponse(
                id,
                title,
                provider,
                activityTypeId,
                activityTypeName,
                professionalFieldId,
                professionalFieldName,
                startDate,
                endDate,
                declaredHours,
                runningSubmittedHours,
                workflowStatus,
                sourceType,
                sourceReference,
                sourceSubmittedAt,
                evidenceCount,
                passedEvidenceCount,
                failedEvidenceCount,
                changeLogCount,
                version,
                nextValidUntil,
                nextExpired
        );
    }
}
