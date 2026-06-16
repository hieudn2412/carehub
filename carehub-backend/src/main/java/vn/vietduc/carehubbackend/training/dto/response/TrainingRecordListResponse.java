package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record TrainingRecordListResponse(
        Long id,
        Long employeeId,
        String employeeCode,
        String employeeName,
        String activityTypeName,
        String title,
        LocalDate startDate,
        LocalDate endDate,
        BigDecimal declaredHours,
        BigDecimal approvedHours,
        TrainingRecordStatus workflowStatus,
        LocalDateTime submittedAt,
        Long version
) {
}
