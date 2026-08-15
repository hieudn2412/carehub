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
import lombok.Builder;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.AssignmentTargetType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentVariantPolicy;
import vn.vietduc.carehubbackend.user.entity.User;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "exam_assignment_targets",
        uniqueConstraints = @UniqueConstraint(name = "uq_exam_assignment_target_user", columnNames = {"assignment_id", "user_id"})
)
public class ExamAssignmentTarget extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false)
    private ExamAssignment assignment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "audience_id")
    private EvaluationAudience audience;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Immutable paper choice for this user, even when the batch has variants. */
    // V12 makes this non-null in PostgreSQL. Keep the JPA mapping nullable so
    // an old, not-yet-migrated row can still be read during rolling deploy.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_exam_paper_id")
    private ExamPaper assignedExamPaper;

    @Column(name = "assigned_variant_index")
    private Integer assignedVariantIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "variant_policy", nullable = false, length = 32)
    @Builder.Default
    private ExamAssignmentVariantPolicy variantPolicy = ExamAssignmentVariantPolicy.FIXED_PAPER;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 24)
    private AssignmentTargetType targetType;

    @Column(name = "source_position_id")
    private Long sourcePositionId;

    @Column(name = "source_group_id")
    private Long sourceGroupId;

    @Column(name = "audience_version")
    private Integer audienceVersion;

    @Column(name = "audience_rule_version")
    private Integer audienceRuleVersion;

    @Column(name = "matched_rule_json", columnDefinition = "text")
    private String matchedRuleJson;

    @Column(name = "resolved_at")
    private java.time.LocalDateTime resolvedAt;

    @Column(name = "source_department_id")
    private Long sourceDepartmentId;

    @Column(name = "source_department_name")
    private String sourceDepartmentName;

    @Column(name = "source_position_name")
    private String sourcePositionName;
}
