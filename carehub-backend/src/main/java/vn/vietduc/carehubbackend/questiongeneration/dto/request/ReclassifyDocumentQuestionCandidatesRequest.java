package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record ReclassifyDocumentQuestionCandidatesRequest(
        @Min(1)
        @Max(200)
        Integer limit
) {
    public int normalizedLimit() {
        return limit == null ? 50 : limit;
    }
}
