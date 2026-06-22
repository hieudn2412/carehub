package vn.vietduc.carehubbackend.form.submission.dto;

import lombok.Builder;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.submission.entity.*;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Builder
public record FormSubmissionResponse(
        Long id,
        Long assignmentItemId,
        Long formId,
        String formCode,
        Long formVersionId,
        Integer versionNumber,
        String title,
        FormSubmissionStatus status,
        SubjectSnapshot subject,
        FormScoringStatus scoringStatus,
        FormSubmissionResult result,
        BigDecimal totalScore,
        BigDecimal maxScore,
        BigDecimal passingScore,
        BigDecimal convertedScore,
        boolean criticalFailure,
        List<ScoreBreakdown> scoreBreakdown,
        List<AnswerResponse> answers,
        Long lockVersion,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Instant submittedAt
) {
    @Builder
    public record SubjectSnapshot(FormSubjectType type, String employeeCode, String fullName,
                                  String position, String department) {}

    @Builder
    public record AnswerResponse(UUID questionKey, UUID optionKey, Map<String, Object> value) {}

    @Builder
    public record ScoreBreakdown(UUID questionKey, String code, String title, boolean critical,
                                 BigDecimal baseScore, BigDecimal weight, BigDecimal weightedScore,
                                 BigDecimal maxScore) {}
}
