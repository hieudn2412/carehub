package vn.vietduc.carehubbackend.training.dto.response;

import java.math.BigDecimal;

public record TrainingStatusYearlyHoursResponse(
        Integer year,
        BigDecimal approvedHours,
        BigDecimal pendingHours,
        BigDecimal rejectedHours
) {
}
