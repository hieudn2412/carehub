package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record EvaluationAuditLogResponse(
        Long id,
        String action,
        String actionText,
        String entityType,
        Long entityId,
        String actor,
        String summary,
        String detailJson,
        LocalDateTime createdAt
) {
}
