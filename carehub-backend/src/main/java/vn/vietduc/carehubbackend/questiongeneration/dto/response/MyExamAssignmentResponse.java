package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;

public record MyExamAssignmentResponse(
        Long id,
        String name,
        String description,
        Long examPaperId,
        String examPaperCode,
        String examPaperName,
        Long professionalFieldId,
        String professionalFieldName,
        String status,
        String statusText,
        LocalDateTime dueAt,
        LocalDateTime openedAt,
        LocalDateTime createdAt,
        Integer maxAttempts,
        Integer usedAttempts,
        Integer remainingAttempts,
        Long currentAttemptId,
        String currentAttemptStatus,
        String currentAttemptStatusText,
        LocalDateTime currentAttemptExpiresAt,
        String availabilityStatus,
        String availabilityText,
        String actionLabel,
        Boolean actionable
) {
}
