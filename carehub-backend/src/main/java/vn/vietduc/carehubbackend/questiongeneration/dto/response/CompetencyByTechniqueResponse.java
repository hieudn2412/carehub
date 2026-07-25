package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record CompetencyByTechniqueResponse(
        Long departmentId,
        String departmentName,
        Long formId,
        String formName,
        double complianceTarget,
        String fromDate,
        String toDate,
        List<CompetencyTechniqueOptionResponse> forms,
        List<CompetencyByTechniqueItemResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
