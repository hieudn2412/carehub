package vn.vietduc.carehubbackend.form.importer.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;

import java.util.List;
import java.util.Map;

@Entity
@Table(name = "form_import_rows")
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class FormImportRow extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "import_batch_id", nullable = false)
    private FormImportBatch batch;

    @Column(name = "source_row_number", nullable = false) private int displayOrder;
    @Column(nullable = false, length = 50) private String requestedCode;
    @Column(nullable = false, length = 255) private String sourceFormId;
    @Column(nullable = false, length = 2000) private String sourceUrl;
    @Column(length = 500) private String sourceTitle;
    @Column(name = "raw_payload", columnDefinition = "TEXT") private String rawPayload;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "normalized_data", columnDefinition = "jsonb")
    private Map<String, Object> normalizedSchema;

    @Column(length = 64) private String sourceHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FormImportRowStatus status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<Map<String, Object>> messages;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "form_template_id") private Form form;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "form_version_id") private FormVersion formVersion;
}
