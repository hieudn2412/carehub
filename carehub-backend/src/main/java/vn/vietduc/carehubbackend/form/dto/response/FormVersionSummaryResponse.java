package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;

import java.time.Instant;
import java.time.LocalDateTime;

@Builder
public record FormVersionSummaryResponse(
        Long id,
        Integer versionNumber,
        FormVersionStatus status,
        String title,
        String schemaHash,
        Instant publishedAt,
        FormVersionResponse.UserSummary publishedBy,
        Long lockVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
