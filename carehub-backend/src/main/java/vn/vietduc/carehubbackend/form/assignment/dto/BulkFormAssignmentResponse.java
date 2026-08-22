package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

@Builder
public record BulkFormAssignmentResponse(
        int formCount,
        int assigneeCount,
        int totalPairs,
        long createdCount,
        long updatedCount,
        long restoredCount,
        long unchangedCount
) {
}
