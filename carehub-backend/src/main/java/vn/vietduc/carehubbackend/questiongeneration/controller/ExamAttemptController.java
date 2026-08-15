package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.RegradeExamAttemptRequest;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAttemptService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationCutoverService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/exam-attempts")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canViewResults(authentication)")
public class ExamAttemptController {
    private final ExamAttemptService attemptService;
    private final EvaluationAuditLogService auditLogService;
    private final EvaluationCutoverService cutover;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ExamAttemptResponse>>> list(
            @RequestParam(required = false) Long assignmentId,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách lượt làm bài thành công",
                attemptService.listAdmin(assignmentId, status)
        ));
    }

    @GetMapping("/{attemptId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> get(@PathVariable Long attemptId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết lượt làm bài thành công",
                attemptService.getAdmin(attemptId)
        ));
    }

    @PostMapping("/{attemptId}/regrade")
    @PreAuthorize("@evaluationSecurity.canPublishExam(authentication)")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> regrade(
            @PathVariable Long attemptId,
            @RequestBody RegradeExamAttemptRequest request,
            Authentication authentication
    ) {
        cutover.requireFieldResults();
        ExamAttemptResponse response = attemptService.regrade(attemptId, request);
        auditLogService.record(
                "EXAM_ATTEMPT_REGRADE",
                "EXAM_ATTEMPT",
                attemptId,
                authentication == null ? "system" : authentication.getName(),
                "Regrade lượt thi #" + attemptId,
                Map.of("policy", request.policy(), "reason", request.reason(), "score", response.score())
        );
        return ResponseEntity.ok(ApiResponse.success("Đã regrade lượt làm bài từ snapshot", response));
    }
}
