package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.time.LocalDateTime;
import java.util.List;

public record CreateExamAssignmentRequest(
        String name,
        String description,
        Long examPaperId,
        Long professionalFieldId,
        List<Long> userIds,
        List<Long> departmentIds,
        List<Long> positionIds,
        List<Long> groupIds,
        Boolean allEmployees,
        LocalDateTime availableFrom,
        LocalDateTime dueAt,
        Integer maxAttempts,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        String resultVisibility,
        String status
) {
}
