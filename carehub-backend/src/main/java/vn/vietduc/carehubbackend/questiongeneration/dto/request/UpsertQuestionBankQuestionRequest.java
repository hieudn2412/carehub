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
        String topic,
        String difficulty,
        String language,
        String sourceDocument,
        String status
) {
}
