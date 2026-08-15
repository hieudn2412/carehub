package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpsertQuestionBankQuestionRequest(
        @NotBlank String stem,
        @NotBlank String optionA,
        @NotBlank String optionB,
        @NotBlank String optionC,
        @NotBlank String optionD,
        @Pattern(regexp = "[ABCDabcd]") String correctAnswer,
        String explanation,
        String language,
        String sourceDocument,
        String status,
        Long categoryId,
        Long professionalFieldId,
        String cognitiveLevel,
        Long sourceDocumentId
) {
    public UpsertQuestionBankQuestionRequest(
            String stem, String optionA, String optionB, String optionC, String optionD,
            String correctAnswer, String explanation,
            String language, String sourceDocument, String status
    ) {
        this(stem, optionA, optionB, optionC, optionD, correctAnswer, explanation,
                language, sourceDocument, status, null, null, null, null);
    }

    /** Compatibility constructor for the category-only client during expand/dual-read. */
    public UpsertQuestionBankQuestionRequest(
            String stem, String optionA, String optionB, String optionC, String optionD,
            String correctAnswer, String explanation,
            String language, String sourceDocument, String status, Long categoryId
    ) {
        this(stem, optionA, optionB, optionC, optionD, correctAnswer, explanation,
                language, sourceDocument, status, categoryId, null, null, null);
    }
}
