package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record CmeApplicableDepartmentsRequest(
        @NotNull Set<@NotNull Long> departmentIds,
        Long version
) {
}
