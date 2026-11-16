package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.math.BigDecimal;
import java.util.Objects;

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
        List<CategoryBlueprint> categoryBlueprints,
        List<FieldBlueprint> fieldBlueprints,
        SourceFilters sourceFilters
) {
    public UpsertExamConfigRequest(
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
            Long audienceId,
            List<FieldBlueprint> fieldBlueprints,
            SourceFilters sourceFilters
    ) {
        this(name, description, totalQuestions, timeLimitMinutes, passingScore, maxRetakes,
                shuffleQuestions, shuffleOptions, backfillNearestCognitiveLevel,
                questionSelectionMode, status, audienceId, null, fieldBlueprints, sourceFilters);
    }

    public List<CategoryBlueprint> effectiveCategoryBlueprints() {
        if (categoryBlueprints != null && !categoryBlueprints.isEmpty()) {
            return categoryBlueprints;
        }
        if (fieldBlueprints != null && !fieldBlueprints.isEmpty()) {
            return fieldBlueprints.stream()
                    .map(fb -> new CategoryBlueprint(
                            fb.categoryId() != null ? fb.categoryId() : fb.professionalFieldId(),
                            fb.percentage(),
                            fb.questionCount(),
                            fb.displayOrder(),
                            fb.passingThreshold(),
                            fb.cognitive()
                    ))
                    .toList();
        }
        return List.of();
    }

    public record CategoryBlueprint(
            Long categoryId,
            BigDecimal percentage,
            Integer questionCount,
            Integer displayOrder,
            BigDecimal passingThreshold,
            List<CognitiveDistribution> cognitive
    ) { }

    public record FieldBlueprint(
            Long professionalFieldId,
            Long categoryId,
            BigDecimal percentage,
            Integer questionCount,
            Integer displayOrder,
            BigDecimal passingThreshold,
            List<CognitiveDistribution> cognitive
    ) {
        public FieldBlueprint(
                Long professionalFieldId,
                BigDecimal percentage,
                Integer questionCount,
                Integer displayOrder,
                BigDecimal passingThreshold,
                List<CognitiveDistribution> cognitive
        ) {
            this(professionalFieldId, null, percentage, questionCount, displayOrder, passingThreshold, cognitive);
        }
    }

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
