package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record EvaluationQuestionBankSummaryResponse(
        Long totalQuestions,
        Long approvedQuestions,
        Long draftQuestions,
        Long rejectedQuestions,
        Long archivedQuestions,
        Long originalQuestions,
        Long paraphraseQuestions,
        List<EvaluationDistributionItemResponse> byStatus,
        List<EvaluationDistributionItemResponse> byDifficulty,
        List<EvaluationDistributionItemResponse> byTopic,
        List<EvaluationDistributionItemResponse> bySource
) {
}
