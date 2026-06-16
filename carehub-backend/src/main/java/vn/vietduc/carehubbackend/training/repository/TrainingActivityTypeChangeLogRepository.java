package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityTypeChangeLog;

import java.util.List;

public interface TrainingActivityTypeChangeLogRepository extends JpaRepository<TrainingActivityTypeChangeLog, Long> {
    List<TrainingActivityTypeChangeLog> findTop20ByActivityType_IdOrderByChangedAtDesc(Long activityTypeId);
}
