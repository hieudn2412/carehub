package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record MyCompetencySkillResponse(
        String fromDate,
        String toDate,
        BigDecimal overallAverage,
        Integer totalEvaluations,
        List<SkillCompetencyItemResponse> items
) {
}
