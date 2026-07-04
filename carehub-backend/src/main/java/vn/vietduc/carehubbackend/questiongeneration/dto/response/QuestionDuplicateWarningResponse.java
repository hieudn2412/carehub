package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record QuestionDuplicateWarningResponse(
        double maxSimilarity,
        Long matchedQuestionId,
        String matchedQuestionStem,
        boolean needsReview,
        String warning,
        String checker
) {
}
