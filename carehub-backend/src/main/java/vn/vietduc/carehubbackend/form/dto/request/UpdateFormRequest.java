package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

@Builder
public record UpdateFormRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description,

        @NotNull(message = "Subject type is required")
        FormSubjectType subjectType,

        Long ownerDepartmentId
) {
}
