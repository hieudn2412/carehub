package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

public record ExamAssignmentResultsResponse(
        Long assignmentId,
        String assignmentName,
        Long examPaperId,
        String examPaperCode,
        String examPaperName,
        Integer targetCount,
        Integer notStartedCount,
        Integer inProgressCount,
        Integer submittedCount,
        Integer gradedCount,
        Integer expiredCount,
        BigDecimal averageScore,
        BigDecimal bestScore,
        List<ExamAssignmentResultRowResponse> rows
) {
}
