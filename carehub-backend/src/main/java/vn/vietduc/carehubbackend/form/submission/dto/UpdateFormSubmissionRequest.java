package vn.vietduc.carehubbackend.form.submission.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public record UpdateFormSubmissionRequest(
        @NotNull @Min(0) Long lockVersion,
        @NotNull @Valid List<AnswerRequest> answers
) {
    @Builder
    public record AnswerRequest(
            @NotNull UUID questionKey,
            UUID optionKey,
            List<UUID> optionKeys,
            @Size(max = 10000) String textValue,
            BigDecimal numberValue,
            LocalDate dateValue,
            LocalTime timeValue
    ) {}
}
