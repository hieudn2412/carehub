package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record QuestionSetSnapshotItemResponse(
        Long id,
        Long sourceQuestionId,
        Integer position,
        BigDecimal points,
        Boolean required,
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
