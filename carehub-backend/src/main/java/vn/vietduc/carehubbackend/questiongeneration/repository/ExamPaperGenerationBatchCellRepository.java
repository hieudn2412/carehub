package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatch;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatchCell;

import java.util.List;

public interface ExamPaperGenerationBatchCellRepository extends JpaRepository<ExamPaperGenerationBatchCell, Long> {
    List<ExamPaperGenerationBatchCell> findByGenerationBatchOrderByDisplayOrderAscCognitiveLevelAsc(
            ExamPaperGenerationBatch generationBatch
    );
}

