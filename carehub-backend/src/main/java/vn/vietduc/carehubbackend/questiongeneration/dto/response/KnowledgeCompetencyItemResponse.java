package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record KnowledgeCompetencyItemResponse(
        Long categoryId,
        String categoryName,
        Integer attemptCount,
        BigDecimal averageScore,
        Integer passCount,
        Double passRate,
        boolean isPassed,
        List<ExamAttemptBriefResponse> attempts
) {
}
