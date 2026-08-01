package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ChunkGenerationStatus;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "document_question_chunk_results",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_document_question_chunk_result_attempt",
                columnNames = {"job_id", "chunk_id", "attempt_no"}
        )
)
public class DocumentQuestionChunkResult extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private DocumentQuestionJob job;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "chunk_id", nullable = false)
    private DocumentChunk chunk;

    @Column(name = "attempt_no", nullable = false)
    private Integer attemptNo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ChunkGenerationStatus status;

    @Column(name = "knowledge_point_count", nullable = false)
    private Integer knowledgePointCount;

    @Column(name = "raw_question_count", nullable = false)
    private Integer rawQuestionCount;

    @Column(name = "reviewable_count", nullable = false)
    private Integer reviewableCount;

    @Column(name = "rejected_count", nullable = false)
    private Integer rejectedCount;

    @Column(name = "critic_call_count", nullable = false)
    private Integer criticCallCount;

    @Column(name = "repair_call_count", nullable = false)
    private Integer repairCallCount;

    @Column(name = "llm_call_count", nullable = false)
    private Integer llmCallCount;

    @Column(name = "prompt_tokens", nullable = false)
    private Integer promptTokens;

    @Column(name = "completion_tokens", nullable = false)
    private Integer completionTokens;

    @Column(name = "total_tokens", nullable = false)
    private Integer totalTokens;

    @Column(name = "latency_ms", nullable = false)
    private Long latencyMs;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(nullable = false)
    private Boolean retryable;
}
