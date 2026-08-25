package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionDocument;

import java.util.List;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, Long> {
    List<DocumentChunk> findByDocumentOrderByChunkIndexAsc(QuestionDocument document);

    /**
     * Xoá thẳng bằng một câu lệnh, không nạp entity lên persistence context —
     * nạp rồi deleteAllInBatch sẽ để lại entity managed trỏ vào document đã bị
     * xoá, khiến flush cuối giao dịch ném TransientPropertyValueException.
     */
    @Modifying
    @Query("delete from DocumentChunk c where c.document = :document")
    int deleteAllByDocument(@Param("document") QuestionDocument document);
}
