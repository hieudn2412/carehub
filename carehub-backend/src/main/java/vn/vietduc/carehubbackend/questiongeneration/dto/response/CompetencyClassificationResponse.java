package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CompetencyClassificationResponse(
        Long employeeId,
        String employeeCode,
        String employeeName,
        String departmentName,
        String overallLevel,
        String overallLevelText,
        String overallLevelColor,
        BigDecimal overallScore,
        Integer totalAttempts,
        LocalDateTime lastAttemptAt,
        List<CategoryClassificationResponse> categoryBreakdowns
) {
}
