package vn.vietduc.carehubbackend.imports.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
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
@Table(name = "import_logs")
public class ImportLog extends BaseEntity {
    @Column(nullable = false)
    private String sourceFile;

    @Column(nullable = false)
    private String status;

    private int totalRows;

    private int insertedRows;

    private int updatedRows;

    private int failedRows;

    private long durationMs;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String rowResultsJson;
}
