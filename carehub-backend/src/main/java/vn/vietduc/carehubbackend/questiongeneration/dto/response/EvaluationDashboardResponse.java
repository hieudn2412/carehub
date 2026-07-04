package vn.vietduc.carehubbackend.questiongeneration.dto.response;

import java.util.List;

public record EvaluationDashboardResponse(
        EvaluationQuestionBankSummaryResponse questionBank,
        EvaluationExamResultsSummaryResponse examResults,
        List<EvaluationQuestionItemAnalysisResponse> itemAnalysis
) {
}
