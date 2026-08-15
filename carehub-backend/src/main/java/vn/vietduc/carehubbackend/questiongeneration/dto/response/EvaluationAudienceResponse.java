package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record EvaluationAudienceResponse(
        Long id,
        String name,
        Integer ruleVersion,
        String ruleJson,
        Integer version,
        String status,
        String createdBy,
        LocalDateTime usedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        EvaluationAudiencePreviewResponse preview
) { }
