package vn.vietduc.carehubbackend.form.submission.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentItem;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_submissions", indexes = {
        @Index(name = "idx_form_submission_owner", columnList = "submitted_by_user_id,status"),
        @Index(name = "idx_form_submission_assignment_item", columnList = "assignment_item_id")
})
public class FormSubmission extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_item_id", nullable = false)
    private FormAssignmentItem assignmentItem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_version_id", nullable = false)
    private FormVersion formVersion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submitted_by_user_id", nullable = false)
    private User submittedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormSubmissionStatus status;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_status", nullable = false, length = 30)
    private FormScoringStatus scoringStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_status", length = 30)
    private FormSubmissionResult result;

    @Column(name = "total_score", precision = 20, scale = 8)
    private BigDecimal totalScore;

    @Column(name = "max_score", precision = 20, scale = 8)
    private BigDecimal maxScore;

    @Column(name = "passing_score", precision = 20, scale = 8)
    private BigDecimal passingScore;

    @Column(name = "converted_score", precision = 20, scale = 8)
    private BigDecimal convertedScore;

    @Column(name = "critical_failure", nullable = false)
    private boolean criticalFailure;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "score_breakdown", columnDefinition = "jsonb")
    private Map<String, Object> scoreBreakdown;

    @OneToOne(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private FormSubmissionContext subjectContext;

    @Builder.Default
    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<FormAnswer> answers = new ArrayList<>();

    @Version
    private Long lockVersion;
}
