package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record QuestionDuplicateMatchResponse(
        String sourceType,
        Long sourceId,
        String stem,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctAnswer,
        String sourceDocument,
        String status,
        double similarity,
        boolean strongDuplicate
) {
}
