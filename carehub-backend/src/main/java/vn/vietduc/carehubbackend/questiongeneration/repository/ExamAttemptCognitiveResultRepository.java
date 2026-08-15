package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCognitiveResult;

import java.util.List;

public interface ExamAttemptCognitiveResultRepository extends JpaRepository<ExamAttemptCognitiveResult, Long> {
    List<ExamAttemptCognitiveResult> findByAttemptOrderByCognitiveLevelAsc(ExamAttempt attempt);
    List<ExamAttemptCognitiveResult> findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(Long assignmentId);
    @Modifying(flushAutomatically = true)
    @Query("delete from ExamAttemptCognitiveResult result where result.attempt = :attempt")
    void deleteByAttempt(@Param("attempt") ExamAttempt attempt);
}
