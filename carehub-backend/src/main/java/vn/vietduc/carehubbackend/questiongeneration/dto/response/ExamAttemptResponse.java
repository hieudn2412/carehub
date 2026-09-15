package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record ExamAttemptResponse(
        Long id,
        Long assignmentId,
        String assignmentName,
        Long examPaperId,
        String examPaperCode,
        String examPaperName,
        Long userId,
        String employeeCode,
        String userName,
        Integer attemptNumber,
        String status,
        String statusText,
        Instant startedAt,
        Instant submittedAt,
        Instant expiresAt,
        Long remainingSeconds,
        Instant serverNow,
        BigDecimal score,
        Integer correctCount,
        Integer totalQuestions,
        Boolean passed,
        Integer timeSpentSeconds,
        List<ExamAttemptQuestionResponse> questions,
        List<ExamAttemptAnswerResponse> answers
) {
}
