package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record EvaluationImportJobRowResponse(
        Integer rowNumber,
        String stem,
        String status,
        Boolean valid,
        Boolean skipped,
        Long createdQuestionId,
        String errorsText
) {
}
