package vn.vietduc.carehubbackend.questiongeneration.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentChunk;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionChunkResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.DocumentQuestionJob;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ChunkGenerationStatus;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DocumentQuestionChunkResultRepository extends JpaRepository<DocumentQuestionChunkResult, Long> {
    List<DocumentQuestionChunkResult> findByJobOrderByChunkChunkIndexAscAttemptNoDesc(DocumentQuestionJob job);

    List<DocumentQuestionChunkResult> findByJobAndStatusInOrderByChunkChunkIndexAsc(
            DocumentQuestionJob job,
            Collection<ChunkGenerationStatus> statuses
    );

    Optional<DocumentQuestionChunkResult> findFirstByJobAndChunkOrderByAttemptNoDesc(
            DocumentQuestionJob job,
            DocumentChunk chunk
    );
}
