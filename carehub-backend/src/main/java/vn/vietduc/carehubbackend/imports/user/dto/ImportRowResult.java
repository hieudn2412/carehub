package vn.vietduc.carehubbackend.imports.user.dto;

import lombok.Builder;

@Builder
public record ImportRowResult(
        int rowNumber,
        String employeeCode,
        String status,
        String message
) {
}
