package vn.vietduc.carehubbackend.training.entity;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import vn.vietduc.carehubbackend.training.enums.TrainingImportRowStatus;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;

import java.util.Map;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "training_import_rows")
public class TrainingImportRow extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "import_batch_id", nullable = false)
    private TrainingImportBatch importBatch;

    @Column(name = "source_row_number", nullable = false)
    private Integer sourceRowNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "raw_data", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> rawData;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "normalized_data", columnDefinition = "jsonb")
    private Map<String, Object> normalizedData;

    @Enumerated(EnumType.STRING)
    @Column(name = "validation_status", nullable = false, length = 30)
    private TrainingImportRowStatus validationStatus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_messages", columnDefinition = "jsonb")
    private Map<String, Object> validationMessages;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "training_record_id")
    private TrainingRecord trainingRecord;
}
