package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;

import java.util.List;
import java.util.Optional;
import java.util.Collection;

public interface QuestionBankQuestionRepository extends JpaRepository<QuestionBankQuestion, Long> {
    /** @deprecated use {@link #findByStatus(QuestionBankStatus, Pageable)} with pagination instead */
    @Deprecated
    List<QuestionBankQuestion> findTop100ByStatus(QuestionBankStatus status);

    /**
     * ORDER BY nằm trong câu truy vấn chứ không để nơi gọi tự truyền {@code Sort}: mọi nơi gọi đều
     * phân trang để quét HẾT bảng, mà PostgreSQL không đảm bảo thứ tự ổn định giữa các trang khi
     * không có ORDER BY — trang sau có thể lặp lại hoặc bỏ sót dòng của trang trước.
     */
    @Query("SELECT q FROM QuestionBankQuestion q WHERE q.status = :status ORDER BY q.id")
    List<QuestionBankQuestion> findByStatus(@Param("status") QuestionBankStatus status, Pageable pageable);

    List<QuestionBankQuestion> findTop500ByStatusOrderByIdAsc(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByStatusOrderByIdDesc(QuestionBankStatus status);

    List<QuestionBankQuestion> findByStatusOrderByIdDesc(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByOrderByIdDesc();

    List<QuestionBankQuestion> findByStatusOrderByIdAsc(QuestionBankStatus status);

    List<QuestionBankQuestion> findByStatusAndProfessionalFieldIdInOrderByIdAsc(QuestionBankStatus status, Collection<Long> professionalFieldIds);

    long countByCategoryIdAndStatus(Long categoryId, QuestionBankStatus status);

    List<QuestionBankQuestion> findByCategoryIdAndStatus(Long categoryId, QuestionBankStatus status);

    boolean existsBySourceDocumentAndStem(String sourceDocument, String stem);

    Optional<QuestionBankQuestion> findFirstBySourceDocumentAndStemOrderByIdAsc(String sourceDocument, String stem);

    long countByStatus(QuestionBankStatus status);

    long countByQuestionType(QuestionType questionType);

    long countBySourceDocumentRef(QuestionDocument sourceDocumentRef);

    @Query("""
            SELECT CAST(q.status AS string) AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY q.status
            """)
    List<CountByKeyProjection> countGroupByStatus();

    @Query("""
            SELECT COALESCE(CAST(q.cognitiveLevel AS string), 'Chưa phân loại') AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY COALESCE(CAST(q.cognitiveLevel AS string), 'Chưa phân loại')
            ORDER BY COUNT(q) DESC
            """)
    List<CountByKeyProjection> countGroupByCognitiveLevel();

    @Query("""
            SELECT COALESCE(q.category.name, 'Chưa phân loại') AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY COALESCE(q.category.name, 'Chưa phân loại')
            ORDER BY COUNT(q) DESC
            """)
    List<CountByKeyProjection> countGroupByCategory();

    @Query("""
            SELECT COALESCE(q.sourceDocument, 'Không rõ nguồn') AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY COALESCE(q.sourceDocument, 'Không rõ nguồn')
            ORDER BY COUNT(q) DESC
            """)
    List<CountByKeyProjection> countGroupBySourceDocument();
}
