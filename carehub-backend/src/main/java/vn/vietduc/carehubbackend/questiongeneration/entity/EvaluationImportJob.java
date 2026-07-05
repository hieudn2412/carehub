package vn.vietduc.carehubbackend.questiongeneration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.EvaluationImportStatus;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "evaluation_import_jobs",
        indexes = {
                @Index(name = "idx_evaluation_import_type", columnList = "import_type"),
                @Index(name = "idx_evaluation_import_status", columnList = "status"),
                @Index(name = "idx_evaluation_import_actor", columnList = "actor"),
                @Index(name = "idx_evaluation_import_created_at", columnList = "created_at")
        }
)
public class EvaluationImportJob extends BaseEntity {

    @Column(name = "import_type", nullable = false, length = 60)
    private String importType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private EvaluationImportStatus status;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(length = 120)
    private String actor;

    @Column(name = "total_rows")
    private Integer totalRows;

    @Column(name = "valid_rows")
    private Integer validRows;

    @Column(name = "invalid_rows")
    private Integer invalidRows;

    @Column(name = "created_rows")
    private Integer createdRows;

    @Column(name = "skipped_rows")
    private Integer skippedRows;

    @Column(name = "failed_rows")
    private Integer failedRows;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;
}
