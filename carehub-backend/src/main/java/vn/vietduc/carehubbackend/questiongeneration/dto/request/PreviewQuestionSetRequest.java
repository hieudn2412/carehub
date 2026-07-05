package vn.vietduc.carehubbackend.questiongeneration.dto.request;

import java.util.List;
import java.util.Map;

public record PreviewQuestionSetRequest(
        String category,
        String topic,
        Map<String, Integer> difficultyDistribution,
        List<Long> excludeQuestionIds,
        Boolean avoidSameSourceDocument,
        Long randomSeed
) {
}
