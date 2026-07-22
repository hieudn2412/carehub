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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "exam_assignments")
public class ExamAssignment extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_paper_id", nullable = false)
    private ExamPaper examPaper;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "professional_field_id")
    private ProfessionalField professionalField;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private ExamAssignmentStatus status;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "max_attempts", nullable = false)
    private Integer maxAttempts;

    @Enumerated(EnumType.STRING)
    @Column(name = "result_visibility", length = 32)
    private ExamResultVisibility resultVisibility;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;
}
