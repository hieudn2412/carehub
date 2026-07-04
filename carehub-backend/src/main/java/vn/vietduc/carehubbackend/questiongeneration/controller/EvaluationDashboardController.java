package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionBankSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionItemAnalysisResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationDashboardService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/evaluation-dashboard")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.hasAny(authentication, 'RESULT_VIEWER', 'QUESTION_REVIEWER', 'QUESTION_SET_MANAGER', 'EXAM_PUBLISHER')")
public class EvaluationDashboardController {
    private final EvaluationDashboardService dashboardService;

    @GetMapping
    public ResponseEntity<ApiResponse<EvaluationDashboardResponse>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy dashboard đánh giá thành công",
                dashboardService.dashboard()
        ));
    }

    @GetMapping("/question-bank-summary")
    public ResponseEntity<ApiResponse<EvaluationQuestionBankSummaryResponse>> questionBankSummary() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy tổng quan ngân hàng câu hỏi thành công",
                dashboardService.questionBankSummary()
        ));
    }

    @GetMapping("/exam-results-summary")
    public ResponseEntity<ApiResponse<EvaluationExamResultsSummaryResponse>> examResultsSummary() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy tổng quan kết quả kiểm tra thành công",
                dashboardService.examResultsSummary()
        ));
    }

    @GetMapping("/question-item-analysis")
    public ResponseEntity<ApiResponse<List<EvaluationQuestionItemAnalysisResponse>>> itemAnalysis() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy phân tích câu hỏi thành công",
                dashboardService.itemAnalysis()
        ));
    }
}
