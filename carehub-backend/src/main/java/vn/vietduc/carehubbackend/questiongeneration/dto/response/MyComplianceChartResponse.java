package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record MyComplianceChartResponse(
        Integer year,
        List<Integer> availableYears,
        List<MyComplianceFormMetricResponse> items
) {
}
