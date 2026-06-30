package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;

import java.util.List;

public interface QuestionBankQuestionRepository extends JpaRepository<QuestionBankQuestion, Long> {
    List<QuestionBankQuestion> findTop100ByStatus(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByStatusOrderByIdAsc(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByStatusOrderByIdDesc(QuestionBankStatus status);

    List<QuestionBankQuestion> findByStatusOrderByIdAsc(QuestionBankStatus status);

    boolean existsBySourceDocumentAndStem(String sourceDocument, String stem);
}
