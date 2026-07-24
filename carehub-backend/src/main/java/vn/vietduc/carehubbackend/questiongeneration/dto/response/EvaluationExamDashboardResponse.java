package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record EvaluationExamDashboardResponse(
        LocalDateTime generatedAt,
        long assignmentCount,
        long targetCount,
        long notStartedCount,
        EvaluationExamResultsSummaryResponse attempts,
        List<ProfessionalFieldItem> byProfessionalField,
        List<PaperItem> byPaper,
        List<EmployeeOption> employees
) {
    public record ProfessionalFieldItem(
            Long professionalFieldId,
            String professionalFieldCode,
            String professionalFieldName,
            long assignmentCount,
            long targetCount,
            long notStartedCount,
            long gradedAttempts,
            long passedAttempts,
            long failedAttempts,
            BigDecimal averageScore,
            BigDecimal passRate
    ) {}

    public record PaperItem(
            Long paperId,
            String paperCode,
            String paperName,
            Integer version,
            Integer totalQuestions,
            Integer passingScore,
            List<String> professionalFieldNames,
            long assignmentCount,
            long targetCount,
            long notStartedCount,
            long gradedAttempts,
            long passedAttempts,
            long failedAttempts,
            BigDecimal averageScore,
            BigDecimal passRate
    ) {}

    public record EmployeeOption(
            Long id,
            String employeeCode,
            String name
    ) {}
}
