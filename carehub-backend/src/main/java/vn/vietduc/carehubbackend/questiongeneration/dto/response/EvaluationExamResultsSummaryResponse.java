package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record EvaluationExamResultsSummaryResponse(
        Long totalAttempts,
        Long inProgressAttempts,
        Long gradedAttempts,
        Long expiredAttempts,
        Long passedAttempts,
        Long failedAttempts,
        BigDecimal averageScore,
        Double passRate,
        Integer averageTimeSpentSeconds,
        List<EvaluationDistributionItemResponse> byStatus
) {
}
