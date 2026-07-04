package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAuditLog;

import java.util.List;

public interface EvaluationAuditLogRepository extends JpaRepository<EvaluationAuditLog, Long> {
    List<EvaluationAuditLog> findTop200ByOrderByCreatedAtDesc();
}
