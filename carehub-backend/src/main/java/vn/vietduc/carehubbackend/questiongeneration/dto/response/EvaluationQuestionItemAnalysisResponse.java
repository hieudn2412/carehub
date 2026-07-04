package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record EvaluationQuestionItemAnalysisResponse(
        Long questionId,
        String stem,
        String topic,
        String difficulty,
        Long attemptCount,
        Long correctCount,
        Long wrongCount,
        Double correctRate
) {
}
