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
        BigDecimal approvedHours,
        BigDecimal runningApprovedHours,
        TrainingRecordStatus workflowStatus,
        TrainingSourceType sourceType,
        String sourceReference,
        LocalDateTime sourceSubmittedAt,
        long evidenceCount,
        long passedEvidenceCount,
        long failedEvidenceCount,
        long reviewCount,
        long changeLogCount,
        String latestRejectionReason,
        Long version
) {
    public EmployeeTrainingRecordLedgerResponse withRunningApprovedHours(BigDecimal nextRunningApprovedHours) {
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
                approvedHours,
                nextRunningApprovedHours,
                workflowStatus,
                sourceType,
                sourceReference,
                sourceSubmittedAt,
                evidenceCount,
                passedEvidenceCount,
                failedEvidenceCount,
                reviewCount,
                changeLogCount,
                latestRejectionReason,
                version
        );
    }
}
