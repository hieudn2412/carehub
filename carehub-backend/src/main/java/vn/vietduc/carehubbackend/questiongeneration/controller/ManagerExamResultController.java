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
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResultsResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAssignmentService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationCutoverService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/manager/exam-assignments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MANAGER')")
public class ManagerExamResultController {
    private final ExamAssignmentService assignmentService;
    private final SecurityUtils securityUtils;
    private final EvaluationCutoverService cutover;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamAssignmentResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách bài kiểm tra của khoa/phòng thành công",
                assignmentService.listForManager(securityUtils.getCurrentUserId(), q, status)
        ));
    }

    @GetMapping("/{assignmentId}")
    public ResponseEntity<ApiResponse<ExamAssignmentResponse>> get(@PathVariable Long assignmentId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy bài kiểm tra của khoa/phòng thành công",
                assignmentService.getForManager(securityUtils.getCurrentUserId(), assignmentId)
        ));
    }

    @GetMapping("/{assignmentId}/results")
    public ResponseEntity<ApiResponse<ExamAssignmentResultsResponse>> results(@PathVariable Long assignmentId) {
        cutover.requireFieldResults();
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy kết quả bài kiểm tra của khoa/phòng thành công",
                assignmentService.resultsForManager(securityUtils.getCurrentUserId(), assignmentId)
        ));
    }
}
