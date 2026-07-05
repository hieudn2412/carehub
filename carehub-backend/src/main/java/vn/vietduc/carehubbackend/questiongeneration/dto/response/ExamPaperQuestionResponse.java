package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record ExamPaperQuestionResponse(
        Long id,
        Long questionId,
        Integer position,
        BigDecimal points,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String explanation,
        String difficulty,
        String topic,
        String sourceDocument
) {
}
