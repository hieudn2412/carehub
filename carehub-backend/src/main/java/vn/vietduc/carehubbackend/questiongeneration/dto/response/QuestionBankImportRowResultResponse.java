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
        String difficulty,
        String language,
        String sourceDocument,
        String status,
        Boolean valid,
        Boolean skipped,
        Long createdQuestionId,
        List<String> errors
) {
}
