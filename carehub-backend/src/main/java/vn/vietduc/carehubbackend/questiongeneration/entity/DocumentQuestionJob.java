package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.GenerationProvider;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.JobStatus;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "document_question_jobs")
public class DocumentQuestionJob extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id", nullable = false)
    private QuestionDocument document;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private GenerationProvider provider;

    @Column(length = 100)
    private String model;

    @Column(name = "prompt_version", length = 64)
    private String promptVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private JobStatus status;

    @Column(name = "questions_per_chunk", nullable = false)
    private Integer questionsPerChunk;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private QuestionCategory category;

    @Column(name = "chunk_count", nullable = false)
    private Integer chunkCount;

    @Column(name = "completed_chunk_count", nullable = false)
    private Integer completedChunkCount;

    @Column(name = "failed_chunk_count", nullable = false)
    private Integer failedChunkCount;

    @Column(name = "candidate_count", nullable = false)
    private Integer candidateCount;

    @Column(name = "chunk_errors", nullable = false, columnDefinition = "text")
    private String chunkErrors;

    @Column(name = "llm_call_count", nullable = false)
    private Integer llmCallCount;

    @Column(name = "total_prompt_tokens", nullable = false)
    private Integer totalPromptTokens;

    @Column(name = "total_completion_tokens", nullable = false)
    private Integer totalCompletionTokens;

    @Column(name = "total_tokens", nullable = false)
    private Integer totalTokens;

    @Column(name = "total_latency_ms", nullable = false)
    private Long totalLatencyMs;

    @Column(name = "estimated_cost_usd", nullable = false)
    private Double estimatedCostUsd;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "trace_id", length = 16)
    private String traceId;

    @Column(name = "created_by", length = 100)
    private String createdBy;
}
