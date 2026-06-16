package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ReviewDecision;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TrainingRecordReviewTimelineResponse(
        Long id,
        ReviewDecision decision,
        BigDecimal declaredHoursSnapshot,
        BigDecimal approvedHours,
        String reason,
        Long reviewedByUserId,
        String reviewedByUserName,
        LocalDateTime reviewedAt
) {
}
