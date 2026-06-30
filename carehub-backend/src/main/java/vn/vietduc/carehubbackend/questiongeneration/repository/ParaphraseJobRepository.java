package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.ParaphraseJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;

import java.util.List;

public interface ParaphraseJobRepository extends JpaRepository<ParaphraseJob, Long> {
    List<ParaphraseJob> findBySourceQuestionOrderByIdDesc(QuestionBankQuestion sourceQuestion);
}
