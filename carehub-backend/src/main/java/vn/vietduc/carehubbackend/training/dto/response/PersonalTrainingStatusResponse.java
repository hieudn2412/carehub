package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record PersonalTrainingStatusResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        ComplianceStatus status,
        BigDecimal requiredHours,
        BigDecimal submittedHours,
        BigDecimal remainingHours,
        BigDecimal progressPercentage,
        Integer cycleYears,
        LocalDate windowStart,
        LocalDate windowEnd,
        Long requirementId,
        String requirementName,
        String warningMessage,
        List<TrainingStatusYearlyHoursResponse> yearlyHours,
        List<TrainingStatusActivityTypeHoursResponse> activityTypeHours,
        List<TrainingStatusRecordSummaryResponse> recentRecords,
        List<TrainingStatusRecordSummaryResponse> attentionRecords
) {
}
