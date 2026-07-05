package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamAttemptAnswerResponse(
        Long paperQuestionId,
        Integer position,
        String selectedAnswer,
        Boolean correct,
        String correctAnswer,
        String explanation
) {
}
