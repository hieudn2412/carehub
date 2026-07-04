package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record BatchCandidateActionErrorResponse(
        Long candidateId,
        String message
) {
}
