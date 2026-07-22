package vn.vietduc.carehubbackend.training.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class TrainingEvidenceMapper {
    public EvidenceMetadataResponse toMetadataResponse(TrainingEvidenceFile entity) {
        long storedSize = entity.getFileSizeBytes() == null ? 0L : entity.getFileSizeBytes();
        long originalSize = entity.getOriginalFileSizeBytes() == null
                ? storedSize
                : entity.getOriginalFileSizeBytes();
        long savedBytes = Math.max(0L, originalSize - storedSize);
        BigDecimal savedPercent = originalSize <= 0
                ? BigDecimal.ZERO.setScale(1)
                : BigDecimal.valueOf(savedBytes)
                        .multiply(BigDecimal.valueOf(100))
                        .divide(BigDecimal.valueOf(originalSize), 1, RoundingMode.HALF_UP);
        return new EvidenceMetadataResponse(
                entity.getId(),
                entity.getTrainingRecord() == null ? null : entity.getTrainingRecord().getId(),
                entity.getOriginalFilename(),
                entity.getMimeType(),
                entity.getFileSizeBytes(),
                originalSize,
                entity.getStoredChecksumSha256() == null
                        ? entity.getChecksumSha256()
                        : entity.getStoredChecksumSha256(),
                entity.isOptimized(),
                savedBytes,
                savedPercent,
                entity.getChecksumSha256(),
                entity.getModerationStatus(),
                entity.getModerationProvider(),
                entity.getModerationResult(),
                entity.getModerationCheckedAt(),
                entity.getUploadedByUser() == null ? null : entity.getUploadedByUser().getId(),
                entity.getUploadedAt(),
                entity.isActive(),
                entity.getLegacyExternalUrl() != null && !entity.getLegacyExternalUrl().isBlank()
        );
    }
}
