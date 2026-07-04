package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record BatchDocumentQuestionCandidateActionRequest(
        List<Long> candidateIds,
        String reviewerNotes
) {
}
