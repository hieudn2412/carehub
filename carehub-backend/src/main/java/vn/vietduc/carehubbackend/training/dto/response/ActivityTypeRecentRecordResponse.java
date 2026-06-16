package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ActivityTypeRecentRecordResponse(
        Long id,
        String title,
        Long employeeId,
        String employeeCode,
        String employeeName,
        LocalDate startDate,
        BigDecimal declaredHours,
        BigDecimal approvedHours,
        TrainingRecordStatus workflowStatus
) {
}
