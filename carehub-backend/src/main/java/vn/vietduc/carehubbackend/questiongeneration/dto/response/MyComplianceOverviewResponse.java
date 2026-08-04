package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record MyComplianceOverviewResponse(
        String fromDate,
        String toDate,
        Integer totalEvaluations,
        Integer passCount,
        BigDecimal complianceRate,
        MyComplianceFormMetricResponse latest
) {
}
