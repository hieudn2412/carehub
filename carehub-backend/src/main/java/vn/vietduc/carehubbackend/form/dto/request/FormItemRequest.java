package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.util.UUID;

@Builder
public record FormItemRequest(
        UUID itemKey,

        @NotNull(message = "Item type is required")
        FormItemType itemType,

        @NotNull(message = "Item display order is required")
        @Min(value = 0, message = "Item display order must not be negative")
        Integer displayOrder,

        @Size(max = 255, message = "Item title must not exceed 255 characters")
        String title,

        @Size(max = 4000, message = "Item description must not exceed 4000 characters")
        String description,

        @Size(max = 2000, message = "Media URL must not exceed 2000 characters")
        String mediaUrl,

        @Valid
        FormQuestionRequest question
) {
}
