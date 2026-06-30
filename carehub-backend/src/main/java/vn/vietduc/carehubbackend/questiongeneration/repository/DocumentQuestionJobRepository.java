package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;

import java.util.List;

public interface DocumentQuestionJobRepository extends JpaRepository<DocumentQuestionJob, Long> {
    List<DocumentQuestionJob> findByDocumentOrderByCreatedAtDesc(QuestionDocument document);
}
