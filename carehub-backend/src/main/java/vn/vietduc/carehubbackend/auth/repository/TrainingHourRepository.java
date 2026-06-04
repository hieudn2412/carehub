package vn.vietduc.carehubbackend.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.user.entity.TrainingHour;

public interface TrainingHourRepository extends JpaRepository<TrainingHour,Long> {
}
