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
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

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

    /** Copied from the source set so assignments cannot retarget a paper to another field. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "professional_field_id")
    private ProfessionalField professionalField;

    @Column(nullable = false, length = 80)
    private String code;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_config_id", nullable = false)
    private ExamConfig examConfig;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_set_id", nullable = false)
    private QuestionSet questionSet;

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

    @Column(name = "easy_percentage")
    private Integer easyPercentage;

    @Column(name = "medium_percentage")
    private Integer mediumPercentage;

    @Column(name = "hard_percentage")
    private Integer hardPercentage;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "published_by", length = 100)
    private String publishedBy;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;
}
