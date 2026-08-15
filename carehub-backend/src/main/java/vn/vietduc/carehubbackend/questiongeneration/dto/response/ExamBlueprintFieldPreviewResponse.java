package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record ExamBlueprintFieldPreviewResponse(
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        BigDecimal percentage,
        Integer requiredQuestionCount,
        Integer availableQuestionCount,
        Integer shortage,
        Integer displayOrder,
        List<ExamBlueprintCellPreviewResponse> cells
) {
    public record ExamBlueprintCellPreviewResponse(
            String cognitiveLevel,
            BigDecimal percentage,
            Integer requiredQuestionCount,
            Integer availableQuestionCount,
            Integer shortage
    ) { }
}
