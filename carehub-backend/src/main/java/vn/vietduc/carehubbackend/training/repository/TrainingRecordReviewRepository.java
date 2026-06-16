package vn.vietduc.carehubbackend.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingRecordReview;

import java.util.List;

public interface TrainingRecordReviewRepository extends JpaRepository<TrainingRecordReview, Long> {
    List<TrainingRecordReview> findByTrainingRecord_IdOrderByReviewedAtDesc(Long trainingRecordId);
}
