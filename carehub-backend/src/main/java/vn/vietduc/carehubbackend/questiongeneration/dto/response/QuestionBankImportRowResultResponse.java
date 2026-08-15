package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record QuestionBankImportRowResultResponse(
        Integer rowNumber,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String topic,
        String language,
        String sourceDocument,
        String status,
        Boolean valid,
        Boolean skipped,
        Long createdQuestionId,
        List<String> errors,
        Long categoryId,
        String categoryCode,
        String categoryName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        Boolean categoryResolved,
        String skipReason,
        String categoryReference,
        String professionalFieldReference,
        String cognitiveLevel,
        java.time.LocalDateTime cognitiveVerifiedAt,
        String cognitiveVerifiedBy
) {
    public QuestionBankImportRowResultResponse(
            Integer rowNumber, String stem, String optionA, String optionB, String optionC,
            String optionD, String correctAnswer, String explanation, String topic,
            String language, String sourceDocument, String status, Boolean valid, Boolean skipped,
            Long createdQuestionId, List<String> errors
    ) {
        this(rowNumber, stem, optionA, optionB, optionC, optionD, correctAnswer, explanation, topic,
                language, sourceDocument, status, valid, skipped, createdQuestionId, errors,
                null, null, null, null, null, null, false, null, topic,
                null, null, null, null);
    }
}
