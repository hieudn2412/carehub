package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;

import java.time.LocalDateTime;
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

    List<TrainingEvidenceFile> findByActiveFalseAndObjectKeyIsNotNullAndStorageDeletedAtIsNullOrderByDeletedAtAsc(
            Pageable pageable
    );

    @Modifying
    @Transactional
    @Query("""
            update TrainingEvidenceFile evidence
               set evidence.storageDeletedAt = :deletedAt
             where evidence.id = :id
               and evidence.active = false
            """)
    int markStorageDeleted(@Param("id") Long id, @Param("deletedAt") LocalDateTime deletedAt);
}
