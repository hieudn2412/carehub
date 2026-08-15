package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationResultReportResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResultBreakdownResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationResultService;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationSecurity;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationCutoverService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDate;

/** Result-only endpoints are intentionally separate from assignment management. */
@RestController
@RequestMapping("${app.api-prefix}/evaluation-results")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
public class EvaluationResultController {
    private final EvaluationResultService resultService;
    private final EvaluationSecurity evaluationSecurity;
    private final SecurityUtils securityUtils;
    private final EvaluationCutoverService cutover;

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<ApiResponse<ExamAttemptResultBreakdownResponse>> attempt(@PathVariable Long attemptId, org.springframework.security.core.Authentication authentication) {
        cutover.requireFieldResults();
        ExamAttemptResultBreakdownResponse response = resultService.attemptBreakdown(attemptId);
        if (!evaluationSecurity.isAdmin(authentication) && !response.userId().equals(securityUtils.getCurrentUserId())) {
            throw new org.springframework.security.access.AccessDeniedException("Bạn chỉ được xem kết quả của chính mình");
        }
        return ResponseEntity.ok(ApiResponse.success("Lấy phân tích kết quả lượt làm bài thành công", response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<EvaluationResultReportResponse>> report(
            @RequestParam Long assignmentId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Integer seniorityMonthsLt,
            @RequestParam(required = false) Integer seniorityMonthsGte,
            @RequestParam(required = false) String asOfDate
    ) {
        cutover.requireFieldResults();
        LocalDate asOf = asOfDate == null || asOfDate.isBlank() ? LocalDate.now() : LocalDate.parse(asOfDate);
        return ResponseEntity.ok(ApiResponse.success("Lấy báo cáo kết quả theo lĩnh vực và mức nhận thức thành công",
                resultService.report(assignmentId, departmentId, seniorityMonthsLt, seniorityMonthsGte, asOf)));
    }
}
