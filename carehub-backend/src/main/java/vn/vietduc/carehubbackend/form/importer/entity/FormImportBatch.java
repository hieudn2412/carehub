package vn.vietduc.carehubbackend.form.importer.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import vn.vietduc.carehubbackend.common.entity.BaseEntity;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "form_import_batches")
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
public class FormImportBatch extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FormImportBatchStatus status;

    @Builder.Default @Column(name = "total_rows", nullable = false) private int totalForms = 0;
    @Builder.Default @Column(name = "success_rows", nullable = false) private int successForms = 0;
    @Builder.Default @Column(name = "failed_rows", nullable = false) private int failedForms = 0;
    @Builder.Default @Column(name = "warning_rows", nullable = false) private int warningForms = 0;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "imported_by_user_id", nullable = false)
    private User importedByUser;

    private LocalDateTime appliedAt;

    @Builder.Default
    @Column(name = "imported_at", nullable = false)
    private LocalDateTime importedAt = LocalDateTime.now();

    @Builder.Default
    @Column(name = "original_filename", nullable = false, length = 500)
    private String originalFilename = "GOOGLE_FORMS_MANIFEST";

    @Builder.Default
    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<FormImportRow> rows = new ArrayList<>();
}
