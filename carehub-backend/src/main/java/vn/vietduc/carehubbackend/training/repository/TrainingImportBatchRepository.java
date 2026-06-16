package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingImportBatch;

public interface TrainingImportBatchRepository extends JpaRepository<TrainingImportBatch, Long> {
}
