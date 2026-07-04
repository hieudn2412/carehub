package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;

import java.util.List;

public interface ExamConfigRepository extends JpaRepository<ExamConfig, Long> {
    List<ExamConfig> findByStatusNotOrderByUpdatedAtDesc(ExamConfigStatus status);

    List<ExamConfig> findByStatusOrderByUpdatedAtDesc(ExamConfigStatus status);
}
