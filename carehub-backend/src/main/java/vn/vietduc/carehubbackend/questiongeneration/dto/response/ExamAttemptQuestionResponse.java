package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record ExamAttemptQuestionResponse(
        Long paperQuestionId,
        Integer position,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String selectedAnswer
) {
}
