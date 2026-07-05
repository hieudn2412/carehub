package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItemSnapshot;

import java.util.List;

public interface QuestionSetItemSnapshotRepository extends JpaRepository<QuestionSetItemSnapshot, Long> {
    boolean existsByQuestionSetItem(QuestionSetItem questionSetItem);

    void deleteByQuestionSetItemIn(List<QuestionSetItem> items);
}
