package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record SaveExamAttemptAnswersRequest(
        List<Answer> answers,
        Integer tabSwitchCount
) {
    public SaveExamAttemptAnswersRequest(List<Answer> answers) {
        this(answers, null);
    }

    public record Answer(
            Long paperQuestionId,
            String selectedAnswer
    ) {
    }
}
