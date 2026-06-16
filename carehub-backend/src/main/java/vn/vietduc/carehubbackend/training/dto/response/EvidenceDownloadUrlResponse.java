package vn.vietduc.carehubbackend.training.dto.response;

import java.time.LocalDateTime;

public record EvidenceDownloadUrlResponse(
        String downloadUrl,
        LocalDateTime expiresAt
) {
}
