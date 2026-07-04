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
        String difficulty,
        String language,
        String sourceDocument,
        String status
) {
}
