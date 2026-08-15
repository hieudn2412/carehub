package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record ReclassifyDocumentQuestionCandidatesResponse(
        int requestedLimit,
        int processedCount,
        int updatedCount,
        int failedCount,
        List<Long> updatedCandidateIds,
        List<String> errors
) {
}
