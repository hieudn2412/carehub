package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;

import java.util.List;

public interface ExamBlueprintCellRepository extends JpaRepository<ExamBlueprintCell, Long> {
    List<ExamBlueprintCell> findByBlueprintFieldId(Long blueprintFieldId);
    void deleteByBlueprintField(ExamBlueprintField blueprintField);
}
