package vn.vietduc.carehubbackend.training.dto.response;

import java.time.LocalDateTime;

public record ProfessionalFieldResponse(
        Long id,
        String code,
        String name,
        String description,
        boolean active,
        Long version,
        LocalDateTime updatedAt
) {
}
