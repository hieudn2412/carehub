package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ExamAttemptBriefResponse(
        Long attemptId,
        String examPaperTitle,
        LocalDate attemptDate,
        BigDecimal score,
        Integer correctCount,
        Integer totalQuestions,
        Boolean passed,
        String competencyLevel,
        String competencyLabel,
        String colorHex
) {
}
