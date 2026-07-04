package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;

import java.util.List;

public interface QuestionBankQuestionRepository extends JpaRepository<QuestionBankQuestion, Long> {
    List<QuestionBankQuestion> findTop100ByStatus(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByStatusOrderByIdAsc(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByStatusOrderByIdDesc(QuestionBankStatus status);

    List<QuestionBankQuestion> findTop500ByOrderByIdDesc();

    List<QuestionBankQuestion> findByStatusOrderByIdAsc(QuestionBankStatus status);

    long countByTopicIgnoreCaseAndStatus(String topic, QuestionBankStatus status);

    boolean existsBySourceDocumentAndStem(String sourceDocument, String stem);

    long countByStatus(QuestionBankStatus status);

    long countByQuestionType(QuestionType questionType);

    @Query("""
            SELECT CAST(q.status AS string) AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY q.status
            """)
    List<CountByKeyProjection> countGroupByStatus();

    @Query("""
            SELECT COALESCE(q.difficulty, 'Chưa phân loại') AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY COALESCE(q.difficulty, 'Chưa phân loại')
            ORDER BY COUNT(q) DESC
            """)
    List<CountByKeyProjection> countGroupByDifficulty();

    @Query("""
            SELECT COALESCE(q.topic, 'Chưa phân loại') AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY COALESCE(q.topic, 'Chưa phân loại')
            ORDER BY COUNT(q) DESC
            """)
    List<CountByKeyProjection> countGroupByTopic();

    @Query("""
            SELECT COALESCE(q.sourceDocument, 'Không rõ nguồn') AS key, COUNT(q) AS count
            FROM QuestionBankQuestion q
            GROUP BY COALESCE(q.sourceDocument, 'Không rõ nguồn')
            ORDER BY COUNT(q) DESC
            """)
    List<CountByKeyProjection> countGroupBySourceDocument();
}
