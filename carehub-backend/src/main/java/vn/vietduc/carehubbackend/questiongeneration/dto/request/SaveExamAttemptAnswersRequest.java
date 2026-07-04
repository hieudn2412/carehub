package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record SaveExamAttemptAnswersRequest(
        List<Answer> answers
) {
    public record Answer(
            Long paperQuestionId,
            String selectedAnswer
    ) {
    }
}
