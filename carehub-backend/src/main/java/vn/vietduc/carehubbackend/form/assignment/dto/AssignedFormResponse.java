package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;

import java.time.Instant;

@Builder
public record AssignedFormResponse(
        Long assignmentItemId,
        Long formId,
        String formCode,
        String title,
        Instant validFrom,
        Instant validUntil,
        FormVersionResponse version
) {
}
