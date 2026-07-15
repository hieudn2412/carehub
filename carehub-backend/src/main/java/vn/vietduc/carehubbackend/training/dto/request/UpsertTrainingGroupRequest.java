package vn.vietduc.carehubbackend.training.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpsertTrainingGroupRequest(
        @NotBlank @Size(max = 100) String name,
        String description,
        List<Long> memberIds,
        Boolean active
) {
}
