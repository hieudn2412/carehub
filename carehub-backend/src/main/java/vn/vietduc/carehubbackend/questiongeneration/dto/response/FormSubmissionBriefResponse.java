package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record FormSubmissionBriefResponse(
        Long submissionId,
        String formName,
        LocalDateTime evaluatedAt,
        String evaluatedBy,
        BigDecimal score,
        Boolean passed,
        String competencyLevel,
        String competencyLabel,
        String colorHex
) {
}
