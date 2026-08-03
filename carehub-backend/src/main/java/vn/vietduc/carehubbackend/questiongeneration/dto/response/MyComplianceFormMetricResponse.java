package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.Instant;

public record MyComplianceFormMetricResponse(
        Long formId,
        String formName,
        Integer evaluationCount,
        Integer passCount,
        BigDecimal complianceRate,
        BigDecimal targetPercent,
        String targetSource,
        Instant latestEvaluatedAt,
        Long latestSubmissionId
) {
}
