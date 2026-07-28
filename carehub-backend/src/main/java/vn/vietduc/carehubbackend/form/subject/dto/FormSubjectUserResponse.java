package vn.vietduc.carehubbackend.form.subject.dto;

import lombok.Builder;

@Builder
public record FormSubjectUserResponse(
        Long userId,
        String employeeCode,
        String fullName,
        String position,
        String department
) {}
