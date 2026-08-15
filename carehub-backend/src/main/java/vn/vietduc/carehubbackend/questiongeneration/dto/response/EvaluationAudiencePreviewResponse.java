package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;
import java.util.Map;

public record EvaluationAudiencePreviewResponse(
        boolean valid,
        int count,
        List<UserSample> sample,
        Map<String, Integer> breakdown,
        List<String> missingData,
        int excludedCount,
        String explanation,
        List<FieldScoreMatch> fieldScoreMatches
) {
    public record UserSample(Long id, String employeeCode, String name, String departmentName, String positionName) { }
    public record FieldScoreMatch(
            Long userId,
            String employeeCode,
            String userName,
            Long attemptId,
            java.time.LocalDateTime submittedAt,
            Long professionalFieldId,
            String professionalFieldCode,
            String professionalFieldName,
            java.math.BigDecimal score,
            java.math.BigDecimal threshold,
            String reason
    ) { }
}
