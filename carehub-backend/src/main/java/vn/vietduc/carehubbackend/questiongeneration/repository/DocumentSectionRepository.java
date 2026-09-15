package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentSection;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;

import java.util.List;

public interface DocumentSectionRepository extends JpaRepository<DocumentSection, Long> {
    List<DocumentSection> findByDocumentOrderByOrderIndexAsc(QuestionDocument document);

    /** Xoá trong một câu lệnh: FK parent_id là NO ACTION nên cha con xoá cùng lượt vẫn hợp lệ. */
    @Modifying
    @Query("delete from DocumentSection s where s.document = :document")
    int deleteAllByDocument(@Param("document") QuestionDocument document);
}
