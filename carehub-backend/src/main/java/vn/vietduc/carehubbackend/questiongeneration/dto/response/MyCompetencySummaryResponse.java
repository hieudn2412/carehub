package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record MyCompetencySummaryResponse(
        String fromDate,
        String toDate,
        BigDecimal knowledgeAverage,
        BigDecimal skillAverage,
        Integer knowledgeAttemptCount,
        Integer skillEvaluationCount,
        BigDecimal overallScore,
        Long departmentId,
        String departmentName,
        BigDecimal targetScore,
        boolean isPassed
) {
}
