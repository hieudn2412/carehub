package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import java.util.List;

public record ParaphraseValidationResult(
        boolean rejected,
        boolean needsReview,
        double lexicalDifference,
        Double semanticSimilarity,
        double duplicateMaxSimilarity,
        Long duplicateQuestionId,
        String duplicateQuestionStem,
        List<String> warnings
) {
}
