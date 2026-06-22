package vn.vietduc.carehubbackend.form.submission.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

public record CreateFormSubmissionRequest(
        @NotNull Long assignmentItemId,
        @NotNull @Valid SubjectRequest subject
) {
    public record SubjectRequest(
            @NotNull FormSubjectType type,
            @NotBlank @Size(max = 100) String employeeCode
    ) {}
}
