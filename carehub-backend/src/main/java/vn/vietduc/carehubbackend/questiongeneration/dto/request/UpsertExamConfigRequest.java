package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.math.BigDecimal;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record UpsertExamConfigRequest(
        @NotBlank String name,
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
        Long audienceId,
        List<FieldBlueprint> fieldBlueprints,
        SourceFilters sourceFilters
) {
    public record FieldBlueprint(
            Long professionalFieldId,
            BigDecimal percentage,
            Integer questionCount,
            Integer displayOrder,
            BigDecimal passingThreshold,
            List<CognitiveDistribution> cognitive
    ) { }

    public record CognitiveDistribution(
            String cognitiveLevel,
            BigDecimal percentage,
            Integer questionCount
    ) { }

    public record SourceFilters(
            List<Long> includedCategoryIds,
            List<Long> excludedCategoryIds,
            List<Long> includedDocumentIds,
            List<Long> excludedDocumentIds
    ) { }
}
