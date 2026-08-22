package vn.vietduc.carehubbackend.form.assignment.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record FormAssignmentCandidateResponse(
        Long id,
        String code,
        String title,
        Long versionId,
        Integer versionNumber,
        Long departmentId,
        String departmentName,
        String employeeCode,
        String fullName,
        List<String> roleCodes
) {
}
