package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfessionalFieldFormRequest(
        @NotBlank @Size(min = 2, max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 2000) String description,
        Boolean active,
        Long version
) {
}
