package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ExamConfigResponse(
        Long id,
        String name,
        String description,
        Integer totalQuestions,
        Integer timeLimitMinutes,
        Integer passingScore,
        Integer maxRetakes,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        Boolean backfillNearestCognitiveLevel,
        String questionSelectionMode,
        String status,
        String statusText,
        List<String> warnings,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        Long audienceId,
        String sourceScope,
        Integer blueprintVersion,
        List<ExamBlueprintFieldPreviewResponse> blueprintCategories,
        List<ExamBlueprintFieldPreviewResponse> blueprintFields,
        String poolChecksum
) {
    public ExamConfigResponse(
            Long id,
            String name,
            String description,
            Integer totalQuestions,
            Integer timeLimitMinutes,
            Integer passingScore,
            Integer maxRetakes,
            Boolean shuffleQuestions,
            Boolean shuffleOptions,
            Boolean backfillNearestCognitiveLevel,
            String questionSelectionMode,
            String status,
            String statusText,
            List<String> warnings,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            Long audienceId,
            String sourceScope,
            Integer blueprintVersion,
            List<ExamBlueprintFieldPreviewResponse> blueprintFields,
            String poolChecksum
    ) {
        this(id, name, description, totalQuestions, timeLimitMinutes, passingScore, maxRetakes,
                shuffleQuestions, shuffleOptions, backfillNearestCognitiveLevel,
                questionSelectionMode, status, statusText, warnings, createdAt, updatedAt,
                audienceId, sourceScope, blueprintVersion, blueprintFields, blueprintFields, poolChecksum);
    }
}
