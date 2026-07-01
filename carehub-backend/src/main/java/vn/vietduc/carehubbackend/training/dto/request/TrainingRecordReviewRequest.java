package vn.vietduc.carehubbackend.training.dto.request;

import java.math.BigDecimal;

public record TrainingRecordReviewRequest(
        BigDecimal approvedHours,
        String reason
) {
}
