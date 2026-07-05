package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record BatchDocumentQuestionCandidateActionResponse(
        Integer requestedCount,
        Integer succeededCount,
        Integer failedCount,
        List<Long> succeededCandidateIds,
        List<BatchCandidateActionErrorResponse> errors,
        List<DocumentQuestionCandidateResponse> candidates
) {
}
