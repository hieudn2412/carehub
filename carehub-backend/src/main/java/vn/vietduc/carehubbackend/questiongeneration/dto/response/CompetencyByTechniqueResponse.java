package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record CompetencyByTechniqueResponse(
        Long departmentId,
        String departmentName,
        Long formId,
        String formName,
        double complianceTarget,
        String fromDate,
        String toDate,
        List<CompetencyByTechniqueItemResponse> items
) {
}
