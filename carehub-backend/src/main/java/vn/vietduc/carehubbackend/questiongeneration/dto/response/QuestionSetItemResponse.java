package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;

public record QuestionSetItemResponse(
        Long id,
        Integer position,
        BigDecimal points,
        Boolean required,
        QuestionBankQuestionResponse question
) {
}
