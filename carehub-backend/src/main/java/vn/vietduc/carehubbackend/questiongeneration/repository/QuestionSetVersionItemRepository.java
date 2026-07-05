package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersionItem;

import java.util.List;

public interface QuestionSetVersionItemRepository extends JpaRepository<QuestionSetVersionItem, Long> {
    List<QuestionSetVersionItem> findByQuestionSetVersionOrderByPositionAsc(QuestionSetVersion questionSetVersion);
}
