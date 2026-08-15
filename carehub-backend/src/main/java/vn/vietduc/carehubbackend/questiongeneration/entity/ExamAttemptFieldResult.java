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

/** Per-field score frozen when an attempt is graded. */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_attempt_field_results", uniqueConstraints = @UniqueConstraint(
        name = "uq_exam_attempt_field_result", columnNames = {"attempt_id", "professional_field_id"}))
public class ExamAttemptFieldResult extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @Column(name = "professional_field_id", nullable = false)
    private Long professionalFieldId;

    @Column(name = "professional_field_code", length = 128)
    private String professionalFieldCode;

    @Column(name = "professional_field_name", nullable = false)
    private String professionalFieldName;

    @Column(name = "correct_count", nullable = false)
    private Integer correctCount;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal score;

    @Column(name = "passing_threshold", nullable = false, precision = 6, scale = 2)
    private BigDecimal passingThreshold;

    @Column(nullable = false)
    private Boolean passed;
}
