package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordChangeLog;

import java.util.List;

public interface TrainingRecordChangeLogRepository extends JpaRepository<TrainingRecordChangeLog, Long> {
    List<TrainingRecordChangeLog> findByTrainingRecord_IdOrderByChangedAtDesc(Long trainingRecordId);
}
