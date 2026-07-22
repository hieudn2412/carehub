package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DiscriminationIndexResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionBankSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionItemAnalysisResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.WrongAnswerDistributionResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationDashboardService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/evaluation-dashboard")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.hasAny(authentication, 'RESULT_VIEWER', 'QUESTION_REVIEWER', 'QUESTION_SET_MANAGER', 'EXAM_PUBLISHER')")
public class EvaluationDashboardController {
    private final EvaluationDashboardService dashboardService;

    @GetMapping
    public ResponseEntity<ApiResponse<EvaluationDashboardResponse>> dashboard(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) Long examConfigId,
            @RequestParam(required = false) Long paperId,
            @RequestParam(required = false) Long assignmentId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long professionalFieldId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy dashboard đánh giá thành công",
                dashboardService.dashboard(
                        parseDateTime(fromDate), parseDateTime(toDate),
                        examConfigId, paperId, assignmentId, departmentId, professionalFieldId)
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
    public ResponseEntity<ApiResponse<EvaluationExamResultsSummaryResponse>> examResultsSummary(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) Long examConfigId,
            @RequestParam(required = false) Long paperId,
            @RequestParam(required = false) Long assignmentId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long professionalFieldId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy tổng quan kết quả kiểm tra thành công",
                dashboardService.examResultsSummary(
                        parseDateTime(fromDate), parseDateTime(toDate),
                        examConfigId, paperId, assignmentId, departmentId, professionalFieldId)
        ));
    }

    @GetMapping("/question-item-analysis")
    public ResponseEntity<ApiResponse<List<EvaluationQuestionItemAnalysisResponse>>> itemAnalysis(
            @RequestParam(required = false) String fromDate,
            @RequestParam(required = false) String toDate,
            @RequestParam(required = false) Long examConfigId,
            @RequestParam(required = false) Long paperId,
            @RequestParam(required = false) Long assignmentId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long professionalFieldId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy phân tích câu hỏi thành công",
                dashboardService.itemAnalysis(
                        parseDateTime(fromDate), parseDateTime(toDate),
                        examConfigId, paperId, assignmentId, departmentId, professionalFieldId)
        ));
    }

    @GetMapping("/discrimination-index")
    public ResponseEntity<ApiResponse<List<DiscriminationIndexResponse>>> discriminationIndex(
            @RequestParam(required = false) Long paperId,
            @RequestParam(required = false) Long assignmentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chỉ số phân biệt thành công",
                dashboardService.discriminationIndex(paperId, assignmentId)
        ));
    }

    @GetMapping("/wrong-answer-distribution")
    public ResponseEntity<ApiResponse<List<WrongAnswerDistributionResponse>>> wrongAnswerDistribution(
            @RequestParam(required = false) Long paperId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy phân phối đáp án sai thành công",
                dashboardService.wrongAnswerDistribution(paperId)
        ));
    }

    private LocalDateTime parseDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            try {
                return LocalDateTime.parse(value + "T00:00:00", DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } catch (Exception ex) {
                return null;
            }
        }
    }
}
