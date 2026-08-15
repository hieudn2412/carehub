package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;
import java.util.Map;

public record PreviewQuestionSetRequest(
        Integer questionCount,
        Map<String, Integer> cognitiveLevelDistribution,
        List<Long> excludeQuestionIds,
        Boolean avoidSameSourceDocument,
        Long randomSeed,
        Long categoryId
) {
    public PreviewQuestionSetRequest(
            Integer questionCount,
            Map<String, Integer> cognitiveLevelDistribution, List<Long> excludeQuestionIds,
            Boolean avoidSameSourceDocument, Long randomSeed
    ) {
        this(questionCount, cognitiveLevelDistribution, excludeQuestionIds,
                avoidSameSourceDocument, randomSeed, null);
    }
}
