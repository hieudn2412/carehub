package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public record TrainingRecordDetailResponse(
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
        String description,
        LocalDate startDate,
        LocalDate endDate,
        LocalTime startTime,
        LocalTime endTime,
        BigDecimal durationValue,
        DurationUnit durationUnit,
        String durationRawText,
        BigDecimal declaredHours,
        BigDecimal approvedHours,
        TrainingRecordStatus workflowStatus,
        Integer editCount,
        LocalDateTime submittedAt,
        Long latestReviewedByUserId,
        LocalDateTime latestReviewedAt,
        String latestRejectionReason,
        TrainingSourceType sourceType,
        String sourceReference,
        LocalDateTime sourceSubmittedAt,
        List<EvidenceMetadataResponse> evidences,
        boolean duplicateWarning,
        long duplicateCandidateCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long version
) {
}
