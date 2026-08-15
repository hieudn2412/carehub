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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "question_sets",
        uniqueConstraints = @UniqueConstraint(name = "uq_question_sets_code", columnNames = "code")
)
public class QuestionSet extends BaseEntity {

    /** A question set is scoped to exactly one professional field. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "professional_field_id")
    private ProfessionalField professionalField;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_set_category_id")
    private QuestionSetCategory questionSetCategory;

    @Column(length = 64)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "cognitive_level", length = 48)
    private CognitiveLevel cognitiveLevel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private QuestionSetStatus status;

    @Column(name = "question_count", nullable = false)
    private Integer questionCount;

    @Column(name = "active_version")
    private Integer activeVersion;

    @Column(name = "snapshot_at")
    private LocalDateTime snapshotAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;
}
