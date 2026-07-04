package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;

import java.util.List;
import java.util.Optional;

public interface ExamPaperRepository extends JpaRepository<ExamPaper, Long> {
    Optional<ExamPaper> findByCode(String code);

    List<ExamPaper> findByStatusNotOrderByUpdatedAtDesc(ExamPaperStatus status);

    List<ExamPaper> findByStatusOrderByUpdatedAtDesc(ExamPaperStatus status);
}
