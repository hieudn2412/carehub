package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.user.entity.User;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamAssignmentTargetRepository extends JpaRepository<ExamAssignmentTarget, Long> {
    @Query("""
            SELECT target
            FROM ExamAssignmentTarget target
            JOIN target.user user
            WHERE target.assignment = :assignment
            ORDER BY user.employeeCode ASC
            """)
    List<ExamAssignmentTarget> findByAssignmentOrderByUserEmployeeCodeAsc(ExamAssignment assignment);

    @Query("""
            SELECT target
            FROM ExamAssignmentTarget target
            JOIN target.assignment assignment
            WHERE target.user = :user
            ORDER BY assignment.updatedAt DESC
            """)
    List<ExamAssignmentTarget> findByUserOrderByAssignmentUpdatedAtDesc(User user);

    Optional<ExamAssignmentTarget> findByAssignmentAndUser(ExamAssignment assignment, User user);
    long countByAssignment(ExamAssignment assignment);
    void deleteByAssignment(ExamAssignment assignment);
}
