package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

/** Aggregate report with explicit denominators for every displayed result cell. */
public record EvaluationResultReportResponse(
        Long assignmentId,
        long gradedAttemptCount,
        List<FieldCoverage> fields,
        List<CognitiveCoverage> cognitive,
        List<CellCoverage> cells
) {
    public record FieldCoverage(Long professionalFieldId, String professionalFieldCode, String professionalFieldName,
                                int correctCount, int totalQuestions, BigDecimal averageScore,
                                int passedAttempts, int evaluatedAttempts) { }
    public record CognitiveCoverage(String cognitiveLevel, String cognitiveLabel,
                                    int correctCount, int totalQuestions, BigDecimal averageScore, int evaluatedAttempts) { }
    public record CellCoverage(Long professionalFieldId, String professionalFieldCode, String professionalFieldName,
                               String cognitiveLevel, String cognitiveLabel, int correctCount, int totalQuestions,
                               int evaluatedAttempts, boolean smallSample) { }
}
