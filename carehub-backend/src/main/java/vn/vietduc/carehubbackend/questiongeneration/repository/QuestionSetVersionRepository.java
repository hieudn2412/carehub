package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSetVersion;

import java.util.List;
import java.util.Optional;

public interface QuestionSetVersionRepository extends JpaRepository<QuestionSetVersion, Long> {
    Optional<QuestionSetVersion> findTopByQuestionSetOrderByVersionDesc(QuestionSet questionSet);

    List<QuestionSetVersion> findByQuestionSetOrderByVersionDesc(QuestionSet questionSet);
}
