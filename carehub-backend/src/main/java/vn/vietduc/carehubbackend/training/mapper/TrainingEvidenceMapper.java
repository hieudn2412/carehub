package vn.vietduc.carehubbackend.training.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;

@Component
public class TrainingEvidenceMapper {
    public EvidenceMetadataResponse toMetadataResponse(TrainingEvidenceFile entity) {
        return new EvidenceMetadataResponse(
                entity.getId(),
                entity.getTrainingRecord() == null ? null : entity.getTrainingRecord().getId(),
                entity.getOriginalFilename(),
                entity.getMimeType(),
                entity.getFileSizeBytes(),
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
