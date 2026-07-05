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
}
