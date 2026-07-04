package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;

import java.util.List;

@Repository
public interface ExamAssignmentRepository extends JpaRepository<ExamAssignment, Long> {
    List<ExamAssignment> findByStatusNotOrderByUpdatedAtDesc(ExamAssignmentStatus status);
    List<ExamAssignment> findByStatusOrderByUpdatedAtDesc(ExamAssignmentStatus status);
}
