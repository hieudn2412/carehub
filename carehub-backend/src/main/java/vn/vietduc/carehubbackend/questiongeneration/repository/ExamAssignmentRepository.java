package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamAssignmentRepository extends JpaRepository<ExamAssignment, Long> {
    List<ExamAssignment> findByStatusNotOrderByUpdatedAtDesc(ExamAssignmentStatus status);
    List<ExamAssignment> findByStatusOrderByUpdatedAtDesc(ExamAssignmentStatus status);
    long countByExamPaperAndStatus(ExamPaper examPaper, ExamAssignmentStatus status);
    long countByExamPaperIdAndStatus(Long examPaperId, ExamAssignmentStatus status);
    Optional<ExamAssignment> findByIdempotencyKey(String idempotencyKey);
}
