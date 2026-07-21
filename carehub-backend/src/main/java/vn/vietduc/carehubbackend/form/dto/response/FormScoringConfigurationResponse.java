package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.scoring.PassingScoreMode;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Builder
public record FormScoringConfigurationResponse(
        Long formId,
        String formCode,
        String formTitle,
        Long versionId,
        Integer versionNumber,
        String versionTitle,
        FormVersionStatus versionStatus,
        BigDecimal criticalWeightPercent,
        BigDecimal normalWeightPercent,
        PassingScoreMode passingScoreMode,
        BigDecimal passingScore,
        BigDecimal passingScoreOverride,
        long submittedCount,
        boolean canEditCriticalWeight,
        boolean canEditPassingScore,
        Long lockVersion,
        FormScoringRecalculationJobResponse latestJob,
        LocalDateTime updatedAt
) {}
