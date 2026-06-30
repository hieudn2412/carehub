package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateParaphraseCandidateRequest(
        @NotBlank String stem,
        @NotBlank String optionA,
        @NotBlank String optionB,
        @NotBlank String optionC,
        @NotBlank String optionD,
        @Pattern(regexp = "[ABCD]") String correctAnswer,
        String explanation,
        String topic,
        String difficulty,
        String reviewerNotes
) {
}
