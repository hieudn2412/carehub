package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

import java.time.LocalDateTime;

@Builder
public record FormPreviewSummaryResponse(
        Long id,
        String code,
        String title,
        String description,
        FormSubjectType subjectType,
        FormStatus status,
        FormResponse.DepartmentSummary ownerDepartment,
        FormVersionSummaryResponse previewVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
