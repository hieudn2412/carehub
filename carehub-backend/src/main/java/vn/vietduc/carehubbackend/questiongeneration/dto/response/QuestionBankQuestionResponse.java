package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record QuestionBankQuestionResponse(
        Long id,
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
        String questionType,
        Long parentQuestionId,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
