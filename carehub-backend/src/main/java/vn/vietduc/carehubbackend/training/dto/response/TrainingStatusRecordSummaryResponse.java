package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record TrainingStatusRecordSummaryResponse(
        Long id,
        String title,
        String activityTypeName,
        LocalDate startDate,
        BigDecimal declaredHours,
        BigDecimal approvedHours,
        TrainingRecordStatus workflowStatus
) {
}
