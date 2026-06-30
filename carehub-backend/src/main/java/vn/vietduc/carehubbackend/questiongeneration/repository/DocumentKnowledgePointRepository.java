package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentKnowledgePoint;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;

import java.util.List;

public interface DocumentKnowledgePointRepository extends JpaRepository<DocumentKnowledgePoint, Long> {
    List<DocumentKnowledgePoint> findByJobOrderByIdAsc(DocumentQuestionJob job);
}
