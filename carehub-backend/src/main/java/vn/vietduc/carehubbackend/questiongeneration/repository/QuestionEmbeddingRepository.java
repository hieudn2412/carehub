package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionEmbedding;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;

import java.util.Collection;
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

    /**
     * Chỉ lấy đúng 3 cột cần cho dedup và đọc vector từ cột nhị phân thay vì cột JSON.
     * Bản {@code findPage...} ở trên nạp cả entity (gồm normalized_text và vector_json dạng text)
     * rồi phải Jackson-parse từng vector — tốn hơn nhiều lần cho cùng một kết quả.
     */
    @Query("""
        SELECT e.question.id AS questionId, e.question.stem AS stem, e.vector AS vector
        FROM QuestionEmbedding e
        WHERE e.textType = :textType
          AND e.embeddingModel = :embeddingModel
          AND e.question.status = :status
          AND e.vector IS NOT NULL
        ORDER BY e.id DESC
    """)
    List<EmbeddingVectorProjection> findVectorPageByTextTypeAndEmbeddingModelAndQuestionStatus(
            @Param("textType") String textType,
            @Param("embeddingModel") String embeddingModel,
            @Param("status") QuestionBankStatus status,
            Pageable pageable
    );

    /** Nạp sẵn khoá tra cứu của cả một lô để khỏi phải gọi findFirst... trong vòng lặp. */
    @Query("""
        SELECT CONCAT(CAST(e.question.id AS string), ':', e.inputTextHash)
        FROM QuestionEmbedding e
        WHERE e.textType = :textType
          AND e.embeddingModel = :embeddingModel
          AND e.question.id IN :questionIds
    """)
    List<String> findExistingKeys(
            @Param("textType") String textType,
            @Param("embeddingModel") String embeddingModel,
            @Param("questionIds") Collection<Long> questionIds
    );

    long countByTextTypeAndEmbeddingModelAndQuestion_Status(
            String textType,
            String embeddingModel,
            QuestionBankStatus status
    );

    void deleteByQuestionAndTextType(QuestionBankQuestion question, String textType);

    long deleteByTextType(String textType);

    interface EmbeddingVectorProjection {
        Long getQuestionId();

        String getStem();

        byte[] getVector();
    }
}
