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
        String topic,
        Long categoryId,
        Long professionalFieldId,
        String cognitiveLevel,
        @NotBlank String sourceExcerpt,
        String reviewerNotes
) {
    public UpdateDocumentQuestionCandidateRequest(
            String stem,
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctAnswer,
            String explanation,
            String topic,
            String sourceExcerpt,
            String reviewerNotes
    ) {
        this(stem, optionA, optionB, optionC, optionD, correctAnswer, explanation,
                topic, null, null, null, sourceExcerpt, reviewerNotes);
    }
}
