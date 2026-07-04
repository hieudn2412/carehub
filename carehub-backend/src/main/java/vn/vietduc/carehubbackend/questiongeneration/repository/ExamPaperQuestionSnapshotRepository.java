package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;

import java.util.List;
import java.util.Optional;

public interface ExamPaperQuestionSnapshotRepository extends JpaRepository<ExamPaperQuestionSnapshot, Long> {
    Optional<ExamPaperQuestionSnapshot> findByExamPaperQuestion(ExamPaperQuestion examPaperQuestion);

    void deleteByExamPaperQuestionIn(List<ExamPaperQuestion> questions);
}
