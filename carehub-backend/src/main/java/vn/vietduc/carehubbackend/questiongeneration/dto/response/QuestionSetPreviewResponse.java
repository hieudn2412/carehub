package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record QuestionSetPreviewResponse(
        List<Long> questionIds,
        List<QuestionBankQuestionResponse> questions,
        List<Shortage> shortage,
        List<String> warnings
) {
    public record Shortage(
            String difficulty,
            Integer requested,
            Integer available
    ) {
    }
}
