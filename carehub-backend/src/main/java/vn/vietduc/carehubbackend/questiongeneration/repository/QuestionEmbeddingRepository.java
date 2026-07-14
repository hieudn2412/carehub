package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** @deprecated use {@link #findPageByTextTypeAndEmbeddingModelAndQuestionStatus} with pagination instead */
    @Deprecated
    List<QuestionEmbedding> findTop500ByTextTypeAndEmbeddingModelAndQuestion_StatusOrderByIdDesc(
            String textType,
            String embeddingModel,
            QuestionBankStatus status
    );

    @Query("""
        SELECT e FROM QuestionEmbedding e
        JOIN FETCH e.question
        WHERE e.textType = :textType
          AND e.embeddingModel = :embeddingModel
          AND e.question.status = :status
        ORDER BY e.id DESC
    """)
    List<QuestionEmbedding> findPageByTextTypeAndEmbeddingModelAndQuestionStatus(
            @Param("textType") String textType,
            @Param("embeddingModel") String embeddingModel,
            @Param("status") QuestionBankStatus status,
            Pageable pageable
    );

    long countByTextTypeAndEmbeddingModelAndQuestion_Status(
            String textType,
            String embeddingModel,
            QuestionBankStatus status
    );

    void deleteByQuestionAndTextType(QuestionBankQuestion question, String textType);
}
