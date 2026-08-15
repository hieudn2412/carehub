package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationAudience;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationAudienceStatus;

import java.util.List;

@Repository
public interface EvaluationAudienceRepository extends JpaRepository<EvaluationAudience, Long> {
    List<EvaluationAudience> findByStatusNotOrderByUpdatedAtDesc(EvaluationAudienceStatus status);
}
