package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperGenerationBatch;

import java.util.Optional;

public interface ExamPaperGenerationBatchRepository extends JpaRepository<ExamPaperGenerationBatch, Long> {
    Optional<ExamPaperGenerationBatch> findByIdempotencyKey(String idempotencyKey);
}

