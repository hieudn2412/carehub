package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;

import java.util.Collection;
import java.util.List;

public interface ExamAttemptFieldResultRepository extends JpaRepository<ExamAttemptFieldResult, Long> {
    List<ExamAttemptFieldResult> findByAttemptOrderByProfessionalFieldIdAsc(ExamAttempt attempt);
    List<ExamAttemptFieldResult> findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(Long assignmentId);
    @Modifying(flushAutomatically = true)
    @Query("delete from ExamAttemptFieldResult result where result.attempt = :attempt")
    void deleteByAttempt(@Param("attempt") ExamAttempt attempt);

    @Query("""
            SELECT result FROM ExamAttemptFieldResult result
            JOIN FETCH result.attempt attempt
            JOIN FETCH attempt.user user
            JOIN FETCH attempt.assignment assignment
            WHERE result.professionalFieldId IN :fieldIds
              AND attempt.status = vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus.GRADED
            ORDER BY attempt.submittedAt DESC, attempt.id DESC
            """)
    List<ExamAttemptFieldResult> findGradedByProfessionalFieldIdIn(@Param("fieldIds") Collection<Long> fieldIds);
}
