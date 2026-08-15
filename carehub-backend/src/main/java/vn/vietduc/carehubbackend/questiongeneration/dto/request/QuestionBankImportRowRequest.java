package vn.vietduc.carehubbackend.questiongeneration.dto.request;

public record QuestionBankImportRowRequest(
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
        Long categoryId,
        String categoryReference,
        Long professionalFieldId,
        String professionalFieldReference,
        String cognitiveLevel
) {
    public QuestionBankImportRowRequest(
            Integer rowNumber, String stem, String optionA, String optionB, String optionC,
            String optionD, String correctAnswer, String explanation, String topic,
            String language, String sourceDocument, String status
    ) {
        this(rowNumber, stem, optionA, optionB, optionC, optionD, correctAnswer, explanation, topic,
                language, sourceDocument, status, null, topic, null, null, null);
    }

    public QuestionBankImportRowRequest(
            Integer rowNumber, String stem, String optionA, String optionB, String optionC,
            String optionD, String correctAnswer, String explanation, String topic,
            String language, String sourceDocument, String status, Long categoryId
    ) {
        this(rowNumber, stem, optionA, optionB, optionC, optionD, correctAnswer, explanation, topic,
                language, sourceDocument, status, categoryId, topic, null, null, null);
    }

    /** Compatibility constructor retaining the Phase 1 category snapshot contract. */
    public QuestionBankImportRowRequest(
            Integer rowNumber, String stem, String optionA, String optionB, String optionC,
            String optionD, String correctAnswer, String explanation, String topic,
            String language, String sourceDocument, String status, Long categoryId, String categoryReference
    ) {
        this(rowNumber, stem, optionA, optionB, optionC, optionD, correctAnswer, explanation, topic,
                language, sourceDocument, status, categoryId, categoryReference, null, null, null);
    }
}
