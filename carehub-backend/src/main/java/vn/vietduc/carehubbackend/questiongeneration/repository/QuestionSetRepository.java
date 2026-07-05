package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;

import java.util.List;
import java.util.Optional;

public interface QuestionSetRepository extends JpaRepository<QuestionSet, Long> {
    Optional<QuestionSet> findByCode(String code);

    List<QuestionSet> findByStatusNotOrderByUpdatedAtDesc(QuestionSetStatus status);
}
