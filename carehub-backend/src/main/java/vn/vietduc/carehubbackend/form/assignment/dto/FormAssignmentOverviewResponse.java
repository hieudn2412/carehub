package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

@Builder
public record FormAssignmentOverviewResponse(
        long assignedFormCount,
        long recipientCount,
        long activePairCount,
        long expiringSoonCount
) {
}
