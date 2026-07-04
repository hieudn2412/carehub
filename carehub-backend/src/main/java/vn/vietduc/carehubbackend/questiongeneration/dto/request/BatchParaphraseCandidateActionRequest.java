package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;

public record BatchParaphraseCandidateActionRequest(
        List<Long> candidateIds,
        String reviewerNotes
) {
}
