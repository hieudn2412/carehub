package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

import java.time.LocalDateTime;

@Builder
public record FormResponse (
        Long id,
        String code,
        String title,
        String description,
        FormSubjectType subjectType,
        FormStatus status,
        DepartmentSummary ownerDepartment,
        VersionSummary currentPublishedVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
){
    @Builder
    public record DepartmentSummary(Long id, String code, String name) {
    }

    @Builder
    public record VersionSummary(Long id, Integer versionNumber) {
    }
}
