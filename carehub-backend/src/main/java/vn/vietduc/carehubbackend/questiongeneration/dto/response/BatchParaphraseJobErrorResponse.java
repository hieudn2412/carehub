package vn.vietduc.carehubbackend.questiongeneration.dto.response;

public record BatchParaphraseJobErrorResponse(
        Long questionId,
        String message
) {
}
