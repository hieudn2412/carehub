package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record TrainingRecordListResponse(
        Long id,
        Long employeeId,
        String employeeCode,
        String employeeName,
        Long employeeDepartmentIdSnapshot,
        String employeeDepartmentNameSnapshot,
        Long activityTypeId,
        String activityTypeName,
        Long professionalFieldId,
        String professionalFieldName,
        String title,
        String provider,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal declaredHours,
        TrainingRecordStatus workflowStatus,
        TrainingSourceType sourceType,
        LocalDateTime submittedAt,
        LocalDateTime updatedAt,
        long evidenceCount,
        long passedEvidenceCount,
        long failedEvidenceCount,
        Long version,
        LocalDate validUntil,
        boolean expired
) {
    public TrainingRecordListResponse(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            Long employeeDepartmentIdSnapshot,
            String employeeDepartmentNameSnapshot,
            Long activityTypeId,
            String activityTypeName,
            Long professionalFieldId,
            String professionalFieldName,
            String title,
            String provider,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal declaredHours,
            TrainingRecordStatus workflowStatus,
            TrainingSourceType sourceType,
            LocalDateTime submittedAt,
            LocalDateTime updatedAt,
            long evidenceCount,
            long passedEvidenceCount,
            long failedEvidenceCount,
            Long version
    ) {
        this(id, employeeId, employeeCode, employeeName, employeeDepartmentIdSnapshot,
                employeeDepartmentNameSnapshot, activityTypeId, activityTypeName,
                professionalFieldId, professionalFieldName, title, provider, startDate,
                endDate, declaredHours, workflowStatus, sourceType, submittedAt, updatedAt,
                evidenceCount, passedEvidenceCount, failedEvidenceCount, version, null, false);
    }

    public TrainingRecordListResponse withValidity(LocalDate nextValidUntil, boolean nextExpired) {
        return new TrainingRecordListResponse(
                id, employeeId, employeeCode, employeeName, employeeDepartmentIdSnapshot,
                employeeDepartmentNameSnapshot, activityTypeId, activityTypeName,
                professionalFieldId, professionalFieldName, title, provider, startDate,
                endDate, declaredHours, workflowStatus, sourceType, submittedAt, updatedAt,
                evidenceCount, passedEvidenceCount, failedEvidenceCount, version,
                nextValidUntil, nextExpired
        );
    }
}
