package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CompetencyClassificationResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        String departmentName,
        BigDecimal overallScore,
        boolean isPassed,
        Integer totalAttempts,
        LocalDateTime lastAttemptAt,
        List<CategoryClassificationResponse> categoryBreakdowns
) {
}
