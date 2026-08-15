package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCellResult;

import java.util.List;

public interface ExamAttemptCellResultRepository extends JpaRepository<ExamAttemptCellResult, Long> {
    List<ExamAttemptCellResult> findByAttemptOrderByProfessionalFieldIdAscCognitiveLevelAsc(ExamAttempt attempt);
    List<ExamAttemptCellResult> findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(Long assignmentId);
    @Modifying(flushAutomatically = true)
    @Query("delete from ExamAttemptCellResult result where result.attempt = :attempt")
    void deleteByAttempt(@Param("attempt") ExamAttempt attempt);
}
