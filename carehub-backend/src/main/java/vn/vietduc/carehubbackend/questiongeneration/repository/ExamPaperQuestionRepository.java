package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;

import java.util.List;

public interface ExamPaperQuestionRepository extends JpaRepository<ExamPaperQuestion, Long> {
    List<ExamPaperQuestion> findByExamPaperOrderByPositionAsc(ExamPaper examPaper);

    @Query("""
            select count(distinct question.examPaper.id)
            from ExamPaperQuestion question
            where question.question = :question
              and question.examPaper.status = :status
            """)
    long countDistinctExamPapersByQuestionAndStatus(
            @Param("question") QuestionBankQuestion question,
            @Param("status") ExamPaperStatus status
    );

    void deleteByExamPaper(ExamPaper examPaper);
}
