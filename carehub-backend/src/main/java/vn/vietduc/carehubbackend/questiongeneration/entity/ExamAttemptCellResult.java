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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;

/** Field × cognitive denominator; a cell with at most one question is informational only. */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_attempt_cell_results", uniqueConstraints = @UniqueConstraint(
        name = "uq_exam_attempt_cell_result", columnNames = {"attempt_id", "professional_field_id", "cognitive_level"}))
public class ExamAttemptCellResult extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @Column(name = "professional_field_id", nullable = false)
    private Long professionalFieldId;

    @Column(name = "professional_field_code", length = 128)
    private String professionalFieldCode;

    @Column(name = "professional_field_name", nullable = false)
    private String professionalFieldName;

    @Enumerated(EnumType.STRING)
    @Column(name = "cognitive_level", nullable = false, length = 48)
    private CognitiveLevel cognitiveLevel;

    @Column(name = "cognitive_label", nullable = false, length = 128)
    private String cognitiveLabel;

    @Column(name = "correct_count", nullable = false)
    private Integer correctCount;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "small_sample", nullable = false)
    private Boolean smallSample;
}
