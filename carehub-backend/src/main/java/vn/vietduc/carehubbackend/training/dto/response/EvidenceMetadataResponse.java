package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

public record EvidenceMetadataResponse(
        Long id,
        Long trainingRecordId,
        String originalFilename,
        String mimeType,
        Long fileSizeBytes,
        Long originalFileSizeBytes,
        String storedChecksumSha256,
        boolean optimized,
        long savedBytes,
        BigDecimal savedPercent,
        String checksumSha256,
        EvidenceModerationStatus moderationStatus,
        String moderationProvider,
        Map<String, Object> moderationResult,
        LocalDateTime moderationCheckedAt,
        Long uploadedByUserId,
        LocalDateTime uploadedAt,
        boolean active,
        boolean legacyEvidence
) {
}
