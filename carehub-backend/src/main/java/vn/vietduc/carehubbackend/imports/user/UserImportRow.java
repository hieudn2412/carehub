package vn.vietduc.carehubbackend.imports.user;

import lombok.Builder;

@Builder
public record UserImportRow(
        String employeeCode,
        String firstName,
        String lastName,
        String gender,
        String departmentName,
        String departmentCode,
        String positionName,
        String educationLevelName
) {}
