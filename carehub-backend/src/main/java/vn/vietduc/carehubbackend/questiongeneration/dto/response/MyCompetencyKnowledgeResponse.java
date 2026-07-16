package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record MyCompetencyKnowledgeResponse(
        String fromDate,
        String toDate,
        BigDecimal overallAverage,
        Integer totalAttempts,
        List<KnowledgeCompetencyItemResponse> items
) {
}
