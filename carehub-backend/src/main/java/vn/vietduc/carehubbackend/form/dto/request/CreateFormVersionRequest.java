package vn.vietduc.carehubbackend.form.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.util.List;
import java.util.Map;

@Builder
public record CreateFormVersionRequest (
        Long sourceVersionId,

        @Size(max = 255, message = "Title must not exceed 255 characters")
        String title,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description,

        Map<String, Object> settings,

        @Valid
        List<FormSectionRequest> sections,

        @Min(value = 0, message = "Lock version must not be negative")
        Long lockVersion
){
}
