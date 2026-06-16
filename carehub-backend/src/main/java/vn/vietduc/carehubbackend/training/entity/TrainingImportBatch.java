package vn.vietduc.carehubbackend.training.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import vn.vietduc.carehubbackend.training.enums.TrainingImportBatchStatus;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "training_import_batches")
public class TrainingImportBatch extends BaseEntity {
    @Column(name = "original_filename", nullable = false, length = 500)
    private String originalFilename;

    @Column(nullable = false, length = 30)
    private TrainingImportBatchStatus status;

    @Builder.Default
    @Column(name = "total_rows", nullable = false)
    private Integer totalRows = 0;

    @Builder.Default
    @Column(name = "success_rows", nullable = false)
    private Integer successRows = 0;

    @Builder.Default
    @Column(name = "failed_rows", nullable = false)
    private Integer failedRows = 0;

    @Builder.Default
    @Column(name = "warning_rows", nullable = false)
    private Integer warningRows = 0;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "imported_by_user_id", nullable = false)
    private User importedByUser;

    @Builder.Default
    @Column(name = "imported_at", nullable = false)
    private LocalDateTime importedAt = LocalDateTime.now();
}
