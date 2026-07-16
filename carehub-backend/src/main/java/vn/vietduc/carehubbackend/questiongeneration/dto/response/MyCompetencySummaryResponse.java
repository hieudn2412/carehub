package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record MyCompetencySummaryResponse(
        String fromDate,
        String toDate,
        BigDecimal knowledgeAverage,
        BigDecimal skillAverage,
        BigDecimal overallScore,
        String competencyLevel,
        String competencyLabel,
        String colorHex,
        boolean isPassed
) {
}
