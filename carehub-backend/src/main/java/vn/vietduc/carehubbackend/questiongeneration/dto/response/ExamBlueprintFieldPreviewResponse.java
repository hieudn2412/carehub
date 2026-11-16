package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record ExamBlueprintFieldPreviewResponse(
        Long categoryId,
        String categoryCode,
        String categoryName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        BigDecimal percentage,
        Integer requiredQuestionCount,
        Integer availableQuestionCount,
        Integer shortage,
        Integer backfilledQuestionCount,
        Integer displayOrder,
        List<ExamBlueprintCellPreviewResponse> cells
) {
    public ExamBlueprintFieldPreviewResponse(
            Long professionalFieldId,
            String professionalFieldCode,
            String professionalFieldName,
            BigDecimal percentage,
            Integer requiredQuestionCount,
            Integer availableQuestionCount,
            Integer shortage,
            Integer backfilledQuestionCount,
            Integer displayOrder,
            List<ExamBlueprintCellPreviewResponse> cells
    ) {
        this(null, null, null, professionalFieldId, professionalFieldCode, professionalFieldName,
                percentage, requiredQuestionCount, availableQuestionCount, shortage,
                backfilledQuestionCount, displayOrder, cells);
    }

    public record ExamBlueprintCellPreviewResponse(
            String cognitiveLevel,
            BigDecimal percentage,
            Integer requiredQuestionCount,
            Integer availableQuestionCount,
            Integer shortage,
            Integer backfilledCount
    ) { }
}
