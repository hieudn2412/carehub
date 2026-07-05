package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ExamAssignmentResultRowResponse(
        Long userId,
        String employeeCode,
        String userName,
        String departmentName,
        Integer attemptCount,
        Long latestAttemptId,
        Integer latestAttemptNumber,
        String latestStatus,
        String latestStatusText,
        BigDecimal latestScore,
        Integer latestCorrectCount,
        Integer latestTotalQuestions,
        Boolean latestPassed,
        BigDecimal bestScore,
        Boolean bestPassed,
        LocalDateTime latestStartedAt,
        LocalDateTime latestSubmittedAt,
        Integer latestTimeSpentSeconds
) {
}
