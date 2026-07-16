package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record CompetencySummaryResponse(
        Long departmentId,
        String departmentName,
        String fromDate,
        String toDate,
        BigDecimal knowledgeWeight,
        BigDecimal skillWeight,
        List<CompetencySummaryItemResponse> items
) {
}
