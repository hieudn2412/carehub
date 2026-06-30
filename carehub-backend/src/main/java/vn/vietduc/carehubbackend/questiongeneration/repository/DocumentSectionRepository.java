package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentSection;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;

import java.util.List;

public interface DocumentSectionRepository extends JpaRepository<DocumentSection, Long> {
    List<DocumentSection> findByDocumentOrderByOrderIndexAsc(QuestionDocument document);
}
