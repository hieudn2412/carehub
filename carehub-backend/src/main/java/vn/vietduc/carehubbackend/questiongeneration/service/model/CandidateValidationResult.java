package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record CandidateValidationResult(
        boolean rejected,
        boolean needsReview,
        double qualityScore,
        List<String> warnings
) {
}
