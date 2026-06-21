package vn.vietduc.carehubbackend.form.importer.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.importer.entity.FormImportBatchStatus;
import vn.vietduc.carehubbackend.form.importer.entity.FormImportRowStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Builder
public record FormImportBatchResponse(
        Long id,
        FormImportBatchStatus status,
        int totalForms,
        int successForms,
        int failedForms,
        int warningForms,
        Long importedByUserId,
        LocalDateTime createdAt,
        LocalDateTime appliedAt,
        List<Row> rows
) {
    @Builder
    public record Row(
            Long id,
            int displayOrder,
            String code,
            String sourceFormId,
            String sourceUrl,
            String sourceTitle,
            String sourceHash,
            FormImportRowStatus status,
            List<Map<String, Object>> messages,
            Map<String, Object> normalizedSchema,
            Long formId,
            Long versionId
    ) {
    }
}
