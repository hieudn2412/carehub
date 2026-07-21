package vn.vietduc.carehubbackend.form.scoring;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "form_scoring_recalculation_jobs", indexes = {
        @Index(name = "idx_form_scoring_job_version_status", columnList = "form_version_id,status")
})
public class FormScoringRecalculationJob extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_version_id", nullable = false)
    private FormVersion formVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormScoringRecalculationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_mode", nullable = false, length = 20)
    private PassingScoreMode targetMode;

    @Column(name = "target_passing_score", precision = 4, scale = 1)
    private BigDecimal targetPassingScore;

    @Column(name = "previous_passing_score", precision = 4, scale = 1)
    private BigDecimal previousPassingScore;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_mode", nullable = false, length = 20)
    private PassingScoreMode previousMode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private User requestedBy;

    @Column(name = "affected_submission_count", nullable = false)
    @Builder.Default
    private Long affectedSubmissionCount = 0L;

    @Column(name = "attempt_count", nullable = false)
    @Builder.Default
    private Integer attemptCount = 0;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;
}
