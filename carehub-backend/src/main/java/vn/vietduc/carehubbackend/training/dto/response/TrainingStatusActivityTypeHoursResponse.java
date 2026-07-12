package vn.vietduc.carehubbackend.training.dto.response;

import java.math.BigDecimal;

public record TrainingStatusActivityTypeHoursResponse(
        Long activityTypeId,
        String activityTypeName,
        BigDecimal submittedHours
) {
}
