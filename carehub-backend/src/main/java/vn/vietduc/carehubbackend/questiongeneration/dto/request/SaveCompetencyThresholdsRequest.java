package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.math.BigDecimal;
import java.util.List;

public record SaveCompetencyThresholdsRequest(
        Long categoryId,
        List<ThresholdEntry> thresholds
) {
    public record ThresholdEntry(
            String competencyLevel,
            BigDecimal minScore,
            BigDecimal maxScore,
            String label,
            String colorHex,
            Integer sortOrder
    ) {
    }
}
