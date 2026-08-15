package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_paper_generation_batches", uniqueConstraints = @UniqueConstraint(
        name = "uq_exam_paper_generation_batches_key",
        columnNames = "idempotency_key"
))
public class ExamPaperGenerationBatch extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @Column(name = "idempotency_key", nullable = false, length = 160)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "config_version", nullable = false)
    private Integer configVersion;

    @Column(name = "master_seed", nullable = false)
    private Long masterSeed;

    @Column(name = "algorithm_version", nullable = false, length = 48)
    private String algorithmVersion;

    @Column(name = "pool_checksum", nullable = false, length = 128)
    private String poolChecksum;

    @Column(name = "variant_count", nullable = false)
    private Integer variantCount;

    @Column(name = "zero_overlap", nullable = false)
    private Boolean zeroOverlap;

    @Column(name = "overlap_question_count", nullable = false)
    private Integer overlapQuestionCount;

    @Column(name = "overlap_percentage", nullable = false, precision = 7, scale = 4)
    private BigDecimal overlapPercentage;

    @Column(name = "generated_by", nullable = false, length = 100)
    private String generatedBy;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;
}

