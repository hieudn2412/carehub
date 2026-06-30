package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record DuplicateCheckResult(
        double maxSimilarity,
        Long matchedQuestionId,
        String matchedQuestionStem,
        boolean strongDuplicate,
        boolean needsReview
) {
}
