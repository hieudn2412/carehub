package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.SaveExamAttemptAnswersRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAssignmentService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAttemptService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/me")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MyExamController {
    private final ExamAssignmentService assignmentService;
    private final ExamAttemptService attemptService;
    private final SecurityUtils securityUtils;

    @GetMapping("/exam-assignments")
    public ResponseEntity<ApiResponse<List<ExamAssignmentResponse>>> listAssignments() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách bài kiểm tra được phân công thành công",
                assignmentService.listForUser(securityUtils.getCurrentUserId())
        ));
    }

    @PostMapping("/exam-assignments/{assignmentId}/start")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> start(@PathVariable Long assignmentId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Bắt đầu làm bài thành công",
                attemptService.start(assignmentId, securityUtils.getCurrentUserId())
        ));
    }

    @GetMapping("/exam-attempts")
    public ResponseEntity<ApiResponse<List<ExamAttemptResponse>>> listAttempts() {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy lịch sử làm bài thành công",
                attemptService.listForUser(securityUtils.getCurrentUserId())
        ));
    }

    @GetMapping("/exam-attempts/{attemptId}")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> getAttempt(@PathVariable Long attemptId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết lượt làm bài thành công",
                attemptService.getForUser(attemptId, securityUtils.getCurrentUserId())
        ));
    }

    @PutMapping("/exam-attempts/{attemptId}/answers")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> saveAnswers(
            @PathVariable Long attemptId,
            @RequestBody SaveExamAttemptAnswersRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu đáp án thành công",
                attemptService.saveAnswers(attemptId, securityUtils.getCurrentUserId(), request)
        ));
    }

    @PostMapping("/exam-attempts/{attemptId}/submit")
    public ResponseEntity<ApiResponse<ExamAttemptResponse>> submit(
            @PathVariable Long attemptId,
            @RequestBody SaveExamAttemptAnswersRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Nộp bài thành công",
                attemptService.submit(attemptId, securityUtils.getCurrentUserId(), request)
        ));
    }
}
