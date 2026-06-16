package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingImportRow;

import java.util.List;

public interface TrainingImportRowRepository extends JpaRepository<TrainingImportRow, Long> {
    List<TrainingImportRow> findByImportBatch_Id(Long importBatchId);
}
