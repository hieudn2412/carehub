package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "evaluation_import_job_rows",
        indexes = {
                @Index(name = "idx_evaluation_import_row_job", columnList = "job_id"),
                @Index(name = "idx_evaluation_import_row_number", columnList = "row_number")
        }
)
public class EvaluationImportJobRow extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private EvaluationImportJob job;

    @Column(name = "row_number")
    private Integer rowNumber;

    @Column(columnDefinition = "text")
    private String stem;

    @Column(length = 24)
    private String status;

    @Column(name = "valid_row")
    private Boolean valid;

    @Column(name = "skipped_row")
    private Boolean skipped;

    @Column(name = "created_question_id")
    private Long createdQuestionId;

    @Column(name = "errors_text", columnDefinition = "text")
    private String errorsText;

    @Column(name = "category_id_snapshot")
    private Long categoryIdSnapshot;

    @Column(name = "category_code_snapshot", length = 80)
    private String categoryCodeSnapshot;

    @Column(name = "category_name_snapshot")
    private String categoryNameSnapshot;

    @Column(name = "professional_field_id_snapshot")
    private Long professionalFieldIdSnapshot;

    @Column(name = "professional_field_code_snapshot", length = 80)
    private String professionalFieldCodeSnapshot;

    @Column(name = "professional_field_name_snapshot")
    private String professionalFieldNameSnapshot;

    @Column(name = "category_resolved")
    private Boolean categoryResolved;

    @Column(name = "skip_reason", columnDefinition = "text")
    private String skipReason;

    @Column(name = "cognitive_level_snapshot", length = 48)
    private String cognitiveLevelSnapshot;

    @Column(name = "cognitive_verified_at_snapshot")
    private java.time.LocalDateTime cognitiveVerifiedAtSnapshot;

    @Column(name = "cognitive_verified_by_snapshot", length = 100)
    private String cognitiveVerifiedBySnapshot;

    @Column(name = "source_document_id_snapshot")
    private Long sourceDocumentIdSnapshot;

    @Column(name = "source_document_filename_snapshot")
    private String sourceDocumentFilenameSnapshot;

    @Column(name = "source_document_content_hash_snapshot", length = 64)
    private String sourceDocumentContentHashSnapshot;
}
