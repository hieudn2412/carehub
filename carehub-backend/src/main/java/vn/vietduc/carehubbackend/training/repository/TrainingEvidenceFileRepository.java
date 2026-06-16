package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;

import java.util.List;

public interface TrainingEvidenceFileRepository extends JpaRepository<TrainingEvidenceFile, Long> {
    List<TrainingEvidenceFile> findByTrainingRecord_IdAndActiveTrue(Long trainingRecordId);
}
