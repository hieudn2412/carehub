package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateDocumentQuestionCandidateRequest(
        @NotBlank String stem,
        @NotBlank String optionA,
        @NotBlank String optionB,
        @NotBlank String optionC,
        @NotBlank String optionD,
        @Pattern(regexp = "[ABCD]") String correctAnswer,
        String explanation,
        String difficulty,
        String topic,
        @NotBlank String sourceExcerpt,
        String reviewerNotes
) {
}
