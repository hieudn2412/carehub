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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamQuestionSelectionMode;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "exam_papers",
        uniqueConstraints = @UniqueConstraint(name = "uq_exam_papers_code", columnNames = "code")
)
public class ExamPaper extends BaseEntity {

    @Column(nullable = false, length = 80)
    private String code;

    @Column(name = "idempotency_key", length = 160)
    private String idempotencyKey;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "generation_batch_id")
    private ExamPaperGenerationBatch generationBatch;

    @Column(name = "variant_index")
    private Integer variantIndex;

    @Column(name = "config_version")
    private Integer configVersion;

    @Column(name = "generation_algorithm_version", length = 48)
    private String generationAlgorithmVersion;

    @Column(name = "generation_pool_checksum", length = 128)
    private String generationPoolChecksum;

    @Column(name = "generated_by", length = 100)
    private String generatedBy;

    @Column(name = "generated_at")
    private LocalDateTime generatedAt;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @Column(nullable = false)
    private Integer version;

    @Column(name = "random_seed", nullable = false)
    private Long randomSeed;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ExamPaperStatus status;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "time_limit_minutes", nullable = false)
    private Integer timeLimitMinutes;

    @Column(name = "passing_score", nullable = false)
    private Integer passingScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_selection_mode", length = 32)
    private ExamQuestionSelectionMode questionSelectionMode;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "published_by", length = 100)
    private String publishedBy;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;
}
