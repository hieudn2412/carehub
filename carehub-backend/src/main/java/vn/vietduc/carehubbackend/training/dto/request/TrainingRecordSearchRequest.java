package vn.vietduc.carehubbackend.training.dto.request;

import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;

import java.time.LocalDate;

public record TrainingRecordSearchRequest(
        String keyword,
        LocalDate dateFrom,
        LocalDate dateTo,
        Long activityTypeId,
        Long professionalFieldId,
        TrainingRecordStatus workflowStatus,
        Boolean hasEvidence,
        EvidenceModerationStatus moderationStatus,
        Long employeeId,
        Long departmentId,
        TrainingSourceType sourceType
) {
}
