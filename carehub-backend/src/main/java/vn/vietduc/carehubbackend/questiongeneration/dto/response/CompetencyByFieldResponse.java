package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record CompetencyByFieldResponse(
        Long departmentId,
        String departmentName,
        Long categoryId,
        String categoryName,
        String fromDate,
        String toDate,
        List<CompetencyByFieldItemResponse> items
) {
}
