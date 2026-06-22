package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.util.List;
import java.util.UUID;

@Builder
public record FormSectionRequest(
        UUID sectionKey,

        @NotBlank(message = "Section title is required")
        @Size(max = 255, message = "Section title must not exceed 255 characters")
        String title,

        @Size(max = 4000, message = "Section description must not exceed 4000 characters")
        String description,

        @NotNull(message = "Section display order is required")
        @Min(value = 0, message = "Section display order must not be negative")
        Integer displayOrder,

        @NotNull(message = "Section items are required")
        @Valid
        List<FormItemRequest> items
) {
}
