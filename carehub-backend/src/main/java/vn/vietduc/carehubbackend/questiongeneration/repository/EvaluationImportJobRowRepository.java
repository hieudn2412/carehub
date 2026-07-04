package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.EvaluationImportJobRow;

import java.util.List;

public interface EvaluationImportJobRowRepository extends JpaRepository<EvaluationImportJobRow, Long> {
    List<EvaluationImportJobRow> findByJobOrderByRowNumberAsc(EvaluationImportJob job);

    void deleteByJob(EvaluationImportJob job);
}
