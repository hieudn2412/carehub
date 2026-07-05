package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.QuestionItemAnalysisProjection;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExamAttemptAnswerRepository extends JpaRepository<ExamAttemptAnswer, Long> {
    @Query("""
            SELECT answer
            FROM ExamAttemptAnswer answer
            JOIN answer.paperQuestion question
            WHERE answer.attempt = :attempt
            ORDER BY question.position ASC
            """)
    List<ExamAttemptAnswer> findByAttemptOrderByPaperQuestionPositionAsc(ExamAttempt attempt);

    Optional<ExamAttemptAnswer> findByAttemptAndPaperQuestion(ExamAttempt attempt, ExamPaperQuestion paperQuestion);
    void deleteByAttempt(ExamAttempt attempt);

    @Query("""
            SELECT question.id AS questionId,
                   question.stem AS stem,
                   question.topic AS topic,
                   question.difficulty AS difficulty,
                   COUNT(answer) AS attemptCount,
                   SUM(CASE WHEN answer.correct = true THEN 1 ELSE 0 END) AS correctCount
            FROM ExamAttemptAnswer answer
            JOIN answer.paperQuestion paperQuestion
            JOIN paperQuestion.question question
            JOIN answer.attempt attempt
            WHERE attempt.status IN :statuses
            GROUP BY question.id, question.stem, question.topic, question.difficulty
            ORDER BY COUNT(answer) DESC
            """)
    List<QuestionItemAnalysisProjection> analyzeQuestionItems(@Param("statuses") Collection<ExamAttemptStatus> statuses);
}
