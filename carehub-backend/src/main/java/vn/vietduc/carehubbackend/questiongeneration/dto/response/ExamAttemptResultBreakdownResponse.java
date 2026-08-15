package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.math.BigDecimal;
import java.util.List;

/** Snapshot-based detail used for the attempt → field → cognitive drill-down. */
public record ExamAttemptResultBreakdownResponse(
        Long attemptId,
        Long assignmentId,
        Long userId,
        BigDecimal overallScore,
        Boolean overallPassed,
        List<FieldResult> fields,
        List<CognitiveResult> cognitive,
        List<CellResult> cells,
        List<QuestionResult> questions
) {
    public record FieldResult(Long professionalFieldId, String professionalFieldCode, String professionalFieldName,
                              int correctCount, int totalQuestions, BigDecimal score, BigDecimal passingThreshold, boolean passed) { }
    public record CognitiveResult(String cognitiveLevel, String cognitiveLabel,
                                  int correctCount, int totalQuestions, BigDecimal score) { }
    public record CellResult(Long professionalFieldId, String professionalFieldCode, String professionalFieldName,
                             String cognitiveLevel, String cognitiveLabel, int correctCount, int totalQuestions,
                             boolean smallSample) { }
    public record QuestionResult(Long paperQuestionId, Integer position, Long professionalFieldId, String professionalFieldCode,
                                 String professionalFieldName, String cognitiveLevel, String cognitiveLabel,
                                 String stem, Boolean correct) { }
}
