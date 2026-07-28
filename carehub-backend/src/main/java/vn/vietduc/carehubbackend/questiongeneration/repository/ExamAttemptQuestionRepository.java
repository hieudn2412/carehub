package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptQuestion;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;

public interface ExamAttemptQuestionRepository extends JpaRepository<ExamAttemptQuestion, Long> {
    List<ExamAttemptQuestion> findByAttemptOrderByPositionAsc(ExamAttempt attempt);

    @Query("""
            select distinct selection.paperQuestion.id
            from ExamAttemptQuestion selection
            where selection.attempt.assignment = :assignment
              and selection.attempt.user = :user
              and selection.attempt.attemptNumber < :attemptNumber
            """)
    List<Long> findPreviouslySeenQuestionIds(
            @Param("assignment") ExamAssignment assignment,
            @Param("user") User user,
            @Param("attemptNumber") Integer attemptNumber
    );
}
