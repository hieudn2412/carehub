package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record UpsertExamConfigRequest(
        @NotBlank String name,
        String description,
        Long questionSetId,
        Integer totalQuestions,
        Integer timeLimitMinutes,
        Integer passingScore,
        Integer maxRetakes,
        Boolean shuffleQuestions,
        Boolean shuffleOptions,
        String questionSelectionMode,
        DifficultyPercentages difficultyPercentages,
        String status,
        List<Distribution> distributions
) {
    public record DifficultyPercentages(
            Integer easy,
            Integer medium,
            Integer hard
    ) {
    }

    public record Distribution(
            Long categoryId,
            String categoryName,
            String difficulty,
            Integer questionCount,
            Boolean required
    ) {
    }
}
