package vn.vietduc.carehubbackend.form.submission.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SubmitFormSubmissionRequest(@NotNull @Min(0) Long lockVersion) {}
