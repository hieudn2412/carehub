package vn.vietduc.carehubbackend.form.importer.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Builder;

import java.util.List;

@Builder
public record FormImportRequest(
        @NotEmpty @Size(max = 25) @Valid List<FormSource> forms
) {
    @Builder
    public record FormSource(
            @NotBlank @Size(min = 2, max = 50)
            @Pattern(regexp = "[A-Za-z0-9_-]+") String code,
            @NotBlank @Size(max = 2000) String sourceUrl,
            @NotNull @Min(0) Integer displayOrder
    ) {
    }
}

