package vn.vietduc.carehubbackend.questiongeneration.service.model;

public record DuplicateCheckResult(
        double maxSimilarity,
        Long matchedQuestionId,
        String matchedQuestionStem,
        boolean strongDuplicate,
        boolean needsReview,
        String warning,
        String checker
) {
    public DuplicateCheckResult(
            double maxSimilarity,
            Long matchedQuestionId,
            String matchedQuestionStem,
            boolean strongDuplicate,
            boolean needsReview
    ) {
        this(maxSimilarity, matchedQuestionId, matchedQuestionStem, strongDuplicate, needsReview, null, "lexical");
    }
}
