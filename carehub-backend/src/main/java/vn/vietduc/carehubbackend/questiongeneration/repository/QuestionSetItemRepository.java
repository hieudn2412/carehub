package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetItem;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;

import java.util.List;

public interface QuestionSetItemRepository extends JpaRepository<QuestionSetItem, Long> {
    List<QuestionSetItem> findByQuestionSetOrderByPositionAsc(QuestionSet questionSet);

    @Query("""
            select count(distinct item.questionSet.id)
            from QuestionSetItem item
            where item.question = :question
              and item.questionSet.status = :status
            """)
    long countDistinctQuestionSetsByQuestionAndStatus(
            @Param("question") QuestionBankQuestion question,
            @Param("status") QuestionSetStatus status
    );

    void deleteByQuestionSet(QuestionSet questionSet);
}
