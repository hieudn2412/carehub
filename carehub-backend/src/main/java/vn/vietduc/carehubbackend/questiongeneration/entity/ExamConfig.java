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
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamQuestionSelectionMode;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSelectionStrategy;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_configs")
public class ExamConfig extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_set_id")
    private QuestionSet questionSet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audience_id")
    private EvaluationAudience audience;

    @Column(name = "source_scope", nullable = false, length = 32)
    @Builder.Default
    private String sourceScope = "QUESTION_BANK";

    @Column(name = "blueprint_version", nullable = false)
    @Builder.Default
    private Integer blueprintVersion = 1;

    @Column(name = "pool_checksum", length = 128)
    private String poolChecksum;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "time_limit_minutes", nullable = false)
    private Integer timeLimitMinutes;

    @Column(name = "passing_score", nullable = false)
    private Integer passingScore;

    @Column(name = "max_retakes", nullable = false)
    private Integer maxRetakes;

    @Column(name = "shuffle_questions", nullable = false)
    private Boolean shuffleQuestions;

    @Column(name = "shuffle_options", nullable = false)
    private Boolean shuffleOptions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ExamConfigStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "selection_strategy", length = 24)
    private QuestionSelectionStrategy selectionStrategy;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_selection_mode", length = 32)
    private ExamQuestionSelectionMode questionSelectionMode;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "reviewed_by", length = 100)
    private String reviewedBy;
}
