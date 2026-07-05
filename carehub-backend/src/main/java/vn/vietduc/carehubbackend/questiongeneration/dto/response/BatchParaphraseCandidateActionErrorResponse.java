package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record BatchParaphraseCandidateActionErrorResponse(
        Long candidateId,
        String message
) {
}
