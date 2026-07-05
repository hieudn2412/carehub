package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record BatchParaphraseCandidateActionResponse(
        Integer requestedCount,
        Integer succeededCount,
        Integer failedCount,
        List<Long> succeededCandidateIds,
        List<BatchParaphraseCandidateActionErrorResponse> errors,
        List<ParaphraseCandidateResponse> candidates
) {
}
