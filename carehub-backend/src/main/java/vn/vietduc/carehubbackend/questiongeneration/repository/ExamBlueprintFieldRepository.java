package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;

import java.util.List;

public interface ExamBlueprintFieldRepository extends JpaRepository<ExamBlueprintField, Long> {
    List<ExamBlueprintField> findByExamConfigIdOrderByDisplayOrderAsc(Long examConfigId);
    void deleteByExamConfig(ExamConfig examConfig);
}
