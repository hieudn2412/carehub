package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionEmbedding;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;

import java.util.List;
import java.util.Optional;

public interface QuestionEmbeddingRepository extends JpaRepository<QuestionEmbedding, Long> {
    Optional<QuestionEmbedding> findFirstByQuestionAndTextTypeAndEmbeddingModelAndInputTextHash(
            QuestionBankQuestion question,
            String textType,
            String embeddingModel,
            String inputTextHash
    );

    List<QuestionEmbedding> findTop500ByTextTypeAndEmbeddingModelAndQuestion_StatusOrderByIdDesc(
            String textType,
            String embeddingModel,
            QuestionBankStatus status
    );

    long countByTextTypeAndEmbeddingModelAndQuestion_Status(
            String textType,
            String embeddingModel,
            QuestionBankStatus status
    );

    void deleteByQuestionAndTextType(QuestionBankQuestion question, String textType);
}
