package vn.vietduc.carehubbackend.form.subject.dto;

import lombok.Builder;

@Builder
public record FormSubjectUserResponse(
        String employeeCode,
        String fullName,
        String position,
        String department
) {}
