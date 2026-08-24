package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record BulkFormAssignmentPreviewResponse(
        int formCount,
        int assigneeCount,
        int totalPairs,
        long newCount,
        long updatedCount,
        long restoredCount,
        long unchangedCount,
        List<PairPreview> pairs
) {
    @Builder
    public record PairPreview(
            Long formId,
            String formCode,
            String formTitle,
            Long assigneeId,
            String assigneeCode,
            String assigneeName,
            String action
    ) {
    }
}
