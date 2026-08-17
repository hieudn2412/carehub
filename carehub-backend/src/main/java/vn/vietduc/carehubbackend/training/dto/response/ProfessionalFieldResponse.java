package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.ProfessionalFieldModerationStatus;

import java.time.LocalDateTime;

public record ProfessionalFieldResponse(
        Long id,
        String code,
        String name,
        String description,
        boolean active,
        ProfessionalFieldModerationStatus moderationStatus,
        String rejectionReason,
        Long version,
        LocalDateTime updatedAt
) {
}
