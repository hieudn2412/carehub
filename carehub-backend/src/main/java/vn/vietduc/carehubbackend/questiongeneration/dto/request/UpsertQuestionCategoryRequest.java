package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;

public record UpsertQuestionCategoryRequest(
        String code,
        @NotBlank String name,
        String description,
        String status,
        Integer sortOrder
) {
}
