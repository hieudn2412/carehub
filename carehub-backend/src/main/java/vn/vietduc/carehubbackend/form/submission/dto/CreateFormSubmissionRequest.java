package vn.vietduc.carehubbackend.form.submission.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;

public record CreateFormSubmissionRequest(
        Long assignmentItemId,
        Long formVersionId,
        @NotNull @Valid SubjectRequest subject
) {
    public CreateFormSubmissionRequest(Long assignmentItemId, SubjectRequest subject) {
        this(assignmentItemId, null, subject);
    }

    @AssertTrue(message = "Cần cung cấp đúng một trong assignmentItemId hoặc formVersionId")
    public boolean hasExactlyOneFormSource() {
        return (assignmentItemId == null) != (formVersionId == null);
    }
    public record SubjectRequest(
            @NotNull FormSubjectType type,
            @Positive Long userId,
            @Size(max = 100) String employeeCode
    ) {
        @AssertTrue(message = "Cần cung cấp đúng một trong subject.userId hoặc subject.employeeCode")
        public boolean hasExactlyOneUserReference() {
            boolean hasUserId = userId != null;
            boolean hasEmployeeCode = employeeCode != null && !employeeCode.isBlank();
            return hasUserId != hasEmployeeCode;
        }
    }
}
