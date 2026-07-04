package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpsertQuestionClassificationRuleRequest(
        @NotBlank String name,
        @NotNull Long categoryId,
        @NotBlank String keywords,
        String sourcePattern,
        Integer priority,
        Boolean enabled
) {
}
