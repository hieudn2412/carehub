package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record WrongAnswerDistributionResponse(
        Long questionId,
        String stem,
        String correctAnswer,
        List<AnswerOptionCount> optionCounts
) {
    public record AnswerOptionCount(
            String option,
            Long count,
            Double percentage
    ) {
    }
}
