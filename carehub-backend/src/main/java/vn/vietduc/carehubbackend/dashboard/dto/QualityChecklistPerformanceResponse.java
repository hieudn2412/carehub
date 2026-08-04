package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;

@Builder
public record QualityChecklistPerformanceResponse(
        Long formId,
        String formCode,
        String formTitle,
        Long currentPublishedVersionId,
        Integer versionNumber,
        long monitoringCount,
        long passedCount,
        long failedCount,
        long uniqueSubjectCount,
        BigDecimal complianceRate,
        BigDecimal averageConvertedScore,
        Instant lastSubmittedAt,
        BigDecimal targetPercent,
        String targetSource
) {}
