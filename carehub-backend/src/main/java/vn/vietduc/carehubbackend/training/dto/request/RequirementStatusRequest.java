package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.NotNull;

public record RequirementStatusRequest(
        @NotNull Boolean active,
        Long version
) {
}
