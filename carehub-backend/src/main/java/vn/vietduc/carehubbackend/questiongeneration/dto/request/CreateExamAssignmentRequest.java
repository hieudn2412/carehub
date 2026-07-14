package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.time.LocalDateTime;
import java.util.List;

public record CreateExamAssignmentRequest(
        String name,
        String description,
        Long examPaperId,
        List<Long> userIds,
        List<Long> departmentIds,
        List<Long> positionIds,
        List<Long> groupIds,
        Boolean allEmployees,
        LocalDateTime dueAt,
        Integer maxAttempts,
        String resultVisibility,
        String status
) {
}
