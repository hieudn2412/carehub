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
import lombok.Builder;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentRetakeVariantPolicy;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentVariantPolicy;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_assignments")
public class ExamAssignment extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "idempotency_key", length = 160, unique = true)
    private String idempotencyKey;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_paper_id", nullable = false)
    private ExamPaper examPaper;

    /** Batch is optional for legacy single-paper assignments. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generation_batch_id")
    private ExamPaperGenerationBatch generationBatch;

    @Enumerated(EnumType.STRING)
    @Column(name = "variant_policy", nullable = false, length = 32)
    @Builder.Default
    private ExamAssignmentVariantPolicy variantPolicy = ExamAssignmentVariantPolicy.FIXED_PAPER;

    @Enumerated(EnumType.STRING)
    @Column(name = "retake_variant_policy", nullable = false, length = 32)
    @Builder.Default
    private ExamAssignmentRetakeVariantPolicy retakeVariantPolicy = ExamAssignmentRetakeVariantPolicy.KEEP_VARIANT;

    @Column(name = "request_hash", length = 64)
    private String requestHash;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audience_id")
    private EvaluationAudience audience;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ExamAssignmentStatus status;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "available_from")
    private LocalDateTime availableFrom;

    @Column(name = "max_attempts", nullable = false)
    private Integer maxAttempts;

    @Column(name = "shuffle_questions")
    private Boolean shuffleQuestions;

    @Column(name = "shuffle_options")
    private Boolean shuffleOptions;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_visibility", length = 32)
    private ExamResultVisibility resultVisibility;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
}
