package vn.vietduc.carehubbackend.training.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "training_records")
public class TrainingRecord extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private User employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_department_id_snapshot")
    private Department employeeDepartmentSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "activity_type_id", nullable = false)
    private TrainingActivityType activityType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "professional_field_id")
    private ProfessionalField professionalField;

    @Column(nullable = false, length = 500)
    private String title;

    private String provider;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "duration_value", precision = 10, scale = 2)
    private BigDecimal durationValue;

    @Builder.Default
    @Column(name = "duration_unit", nullable = false, length = 20)
    private DurationUnit durationUnit = DurationUnit.HOUR;

    @Column(name = "duration_raw_text", length = 100)
    private String durationRawText;

    @Column(name = "declared_hours", precision = 8, scale = 2)
    private BigDecimal declaredHours;

    @Column(name = "approved_hours", precision = 8, scale = 2)
    private BigDecimal approvedHours;

    @Builder.Default
    @Column(name = "workflow_status", nullable = false, length = 30)
    private TrainingRecordStatus workflowStatus = TrainingRecordStatus.DRAFT;

    @Builder.Default
    @Column(name = "edit_count", nullable = false)
    private Integer editCount = 0;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "latest_reviewed_by_user_id")
    private User latestReviewedByUser;

    @Column(name = "latest_reviewed_at")
    private LocalDateTime latestReviewedAt;

    @Column(name = "latest_rejection_reason", columnDefinition = "text")
    private String latestRejectionReason;

    @Builder.Default
    @Column(name = "source_type", nullable = false, length = 30)
    private TrainingSourceType sourceType = TrainingSourceType.MANUAL;

    @Column(name = "source_reference")
    private String sourceReference;

    @Column(name = "source_submitted_at")
    private LocalDateTime sourceSubmittedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id")
    private TrainingImportBatch importBatch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id", nullable = false)
    private User createdByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by_user_id")
    private User updatedByUser;

    @Version
    @Builder.Default
    @Column(nullable = false)
    private Long version = 0L;
}
