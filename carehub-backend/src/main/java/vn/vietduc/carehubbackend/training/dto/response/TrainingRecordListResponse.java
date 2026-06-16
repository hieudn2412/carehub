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
        BigDecimal approvedHours,
        TrainingRecordStatus workflowStatus,
        TrainingSourceType sourceType,
        LocalDateTime submittedAt,
        LocalDateTime updatedAt,
        long evidenceCount,
        long passedEvidenceCount,
        long failedEvidenceCount,
        Long version
) {
}
