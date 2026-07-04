package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;

import java.util.List;
import java.util.Optional;

public interface DocumentQuestionJobRepository extends JpaRepository<DocumentQuestionJob, Long> {
    List<DocumentQuestionJob> findByDocumentOrderByCreatedAtDesc(QuestionDocument document);

    Optional<DocumentQuestionJob> findFirstByDocumentOrderByCreatedAtDesc(QuestionDocument document);

    long countByDocument(QuestionDocument document);

    @Query("""
            SELECT job.status
            FROM DocumentQuestionJob job
            WHERE job.id = :jobId
            """)
    JobStatus findStatusByIdOrNull(Long jobId);
}
