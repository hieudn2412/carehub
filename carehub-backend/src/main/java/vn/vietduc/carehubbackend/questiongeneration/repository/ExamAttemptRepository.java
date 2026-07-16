package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Long> {
    List<ExamAttempt> findByAssignmentOrderByStartedAtDesc(ExamAssignment assignment);
    List<ExamAttempt> findByAssignmentAndUserOrderByAttemptNumberDesc(ExamAssignment assignment, User user);
    List<ExamAttempt> findByUserOrderByStartedAtDesc(User user);
    List<ExamAttempt> findByStatusOrderByStartedAtDesc(ExamAttemptStatus status);
    List<ExamAttempt> findAllByOrderByStartedAtDesc();
    long countByAssignmentAndUser(ExamAssignment assignment, User user);
    long countByStatus(ExamAttemptStatus status);
    long countByPassed(Boolean passed);

    @Query("""
            SELECT CAST(attempt.status AS string) AS key, COUNT(attempt) AS count
            FROM ExamAttempt attempt
            GROUP BY attempt.status
            """)
    List<CountByKeyProjection> countGroupByStatus();

    @Query("""
            SELECT a FROM ExamAttempt a
            JOIN FETCH a.examPaper ep
            JOIN FETCH ep.examConfig ec
            JOIN FETCH ec.questionSet qs
            WHERE a.user = :user
              AND a.status IN ('SUBMITTED', 'GRADED')
              AND (:fromDate IS NULL OR a.submittedAt >= :fromDate)
              AND (:toDate IS NULL OR a.submittedAt <= :toDate)
            ORDER BY a.submittedAt DESC
            """)
    List<ExamAttempt> findScoredAttemptsByUserAndDateRange(
            @Param("user") User user,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate);
}
