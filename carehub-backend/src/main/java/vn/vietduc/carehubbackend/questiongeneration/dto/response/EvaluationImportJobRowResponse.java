package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record EvaluationImportJobRowResponse(
        Integer rowNumber,
        String stem,
        String status,
        Boolean valid,
        Boolean skipped,
        Long createdQuestionId,
        String errorsText,
        Long categoryId,
        String categoryCode,
        String categoryName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        Boolean categoryResolved,
        String skipReason,
        String cognitiveLevel,
        java.time.LocalDateTime cognitiveVerifiedAt,
        String cognitiveVerifiedBy
) {
}
