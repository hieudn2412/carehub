package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
        LocalDateTime startedAt,
        LocalDateTime submittedAt,
        LocalDateTime expiresAt,
        BigDecimal score,
        Integer correctCount,
        Integer totalQuestions,
        Boolean passed,
        String classification,
        String classificationText,
        Integer timeSpentSeconds,
        List<ExamAttemptQuestionResponse> questions,
        List<ExamAttemptAnswerResponse> answers
) {
}
