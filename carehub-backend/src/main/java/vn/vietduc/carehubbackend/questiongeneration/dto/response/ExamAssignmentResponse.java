package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record ExamAssignmentResponse(
        Long id,
        String name,
        String description,
        Long examPaperId,
        String examPaperCode,
        String examPaperName,
        Long professionalFieldId,
        String professionalFieldCode,
        String professionalFieldName,
        String status,
        String statusText,
        LocalDateTime availableFrom,
        LocalDateTime dueAt,
        Integer maxAttempts,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        String resultVisibility,
        String resultVisibilityText,
        Integer targetCount,
        Integer attemptCount,
        Integer submittedCount,
        List<ExamAssignmentTargetResponse> targets,
        LocalDateTime openedAt,
        LocalDateTime closedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
