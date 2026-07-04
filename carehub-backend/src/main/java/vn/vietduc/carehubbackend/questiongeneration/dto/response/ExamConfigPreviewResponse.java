package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record ExamConfigPreviewResponse(
        Integer totalQuestions,
        Integer distributedQuestions,
        Boolean valid,
        List<ExamConfigDistributionResponse> distributions,
        List<String> warnings
) {
}
