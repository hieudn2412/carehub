package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.scoring.*;

import java.math.BigDecimal;
import java.time.*;

@Builder
public record FormScoringRecalculationJobResponse(
        Long id,
        Long formId,
        Long versionId,
        FormScoringRecalculationStatus status,
        PassingScoreMode targetMode,
        BigDecimal targetPassingScore,
        PassingScoreMode previousMode,
        BigDecimal previousPassingScore,
        Long affectedSubmissionCount,
        Integer attemptCount,
        String requestedBy,
        Instant startedAt,
        Instant completedAt,
        String errorMessage,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}
