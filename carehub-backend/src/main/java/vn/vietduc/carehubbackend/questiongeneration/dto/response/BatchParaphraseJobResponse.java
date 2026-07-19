package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record BatchParaphraseJobResponse(
        Integer requestedQuestionCount,
        Integer succeededCount,
        Integer failedCount,
        List<ParaphraseJobResponse> jobs,
        List<BatchParaphraseJobErrorResponse> errors,
        Integer queuedCount
) {
}
