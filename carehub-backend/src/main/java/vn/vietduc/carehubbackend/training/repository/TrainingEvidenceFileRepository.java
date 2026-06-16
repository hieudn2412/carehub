package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;

import java.util.List;
import java.util.Optional;

public interface TrainingEvidenceFileRepository extends JpaRepository<TrainingEvidenceFile, Long> {
    List<TrainingEvidenceFile> findByTrainingRecord_IdAndActiveTrue(Long trainingRecordId);

    long countByTrainingRecord_IdAndActiveTrueAndModerationStatus(
            Long trainingRecordId,
            EvidenceModerationStatus moderationStatus
    );

    boolean existsByTrainingRecord_IdAndActiveTrueAndChecksumSha256(Long trainingRecordId, String checksumSha256);

    Optional<TrainingEvidenceFile> findByIdAndTrainingRecord_Id(Long id, Long trainingRecordId);
}
