package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJob;

import java.util.List;

public interface EvaluationImportJobRepository extends JpaRepository<EvaluationImportJob, Long> {
    List<EvaluationImportJob> findTop100ByOrderByCreatedAtDesc();
}
