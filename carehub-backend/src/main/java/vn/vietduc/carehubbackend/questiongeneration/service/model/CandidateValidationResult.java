package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record CandidateValidationResult(
        boolean rejected,
        boolean needsReview,
        Double qualityScore,
        List<String> warnings,
        String validationGrade,
        String validationSource,
        String evidenceStatus,
        String criticStatus
) {
    public CandidateValidationResult(
            boolean rejected,
            boolean needsReview,
            Double qualityScore,
            List<String> warnings
    ) {
        this(
                rejected,
                needsReview,
                qualityScore,
                warnings,
                rejected ? "REJECT" : needsReview ? "REVIEW" : "PASS",
                "RULES_ONLY",
                "UNKNOWN",
                "NOT_RUN"
        );
    }
}
