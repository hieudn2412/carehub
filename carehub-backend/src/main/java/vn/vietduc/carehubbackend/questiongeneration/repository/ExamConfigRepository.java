package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;

import java.util.List;
import java.util.Optional;

public interface ExamConfigRepository extends JpaRepository<ExamConfig, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select config from ExamConfig config where config.id = :id")
    Optional<ExamConfig> findByIdForUpdate(@Param("id") Long id);

    List<ExamConfig> findByStatusNotOrderByUpdatedAtDesc(ExamConfigStatus status);

    List<ExamConfig> findByStatusOrderByUpdatedAtDesc(ExamConfigStatus status);
}
