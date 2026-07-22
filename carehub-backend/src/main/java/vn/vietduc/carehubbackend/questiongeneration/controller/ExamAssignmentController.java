package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateExamAssignmentRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAssignmentResultsResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAssignmentService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/exam-assignments")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canManageAssignment(authentication)")
public class ExamAssignmentController {
    private final ExamAssignmentService assignmentService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamAssignmentResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long professionalFieldId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách phân công kiểm tra thành công",
                assignmentService.list(q, status, professionalFieldId)
        ));
    }

    @GetMapping("/{assignmentId}")
    public ResponseEntity<ApiResponse<ExamAssignmentResponse>> get(@PathVariable Long assignmentId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết phân công kiểm tra thành công",
                assignmentService.get(assignmentId)
        ));
    }

    @GetMapping("/{assignmentId}/results")
    public ResponseEntity<ApiResponse<ExamAssignmentResultsResponse>> results(@PathVariable Long assignmentId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy kết quả phân công kiểm tra thành công",
                assignmentService.results(assignmentId)
        ));
    }

    @GetMapping("/{assignmentId}/export-results")
    public ResponseEntity<byte[]> exportResults(
            @PathVariable Long assignmentId,
            Authentication authentication
    ) {
        byte[] body = assignmentService.exportResultsXlsx(assignmentId);
        auditLogService.record(
                "EXAM_ASSIGNMENT_RESULT_EXPORT",
                "EXAM_ASSIGNMENT",
                assignmentId,
                actor(authentication),
                "Export kết quả phân công #" + assignmentId,
                Map.of("format", "xlsx", "bytes", body.length)
        );
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("exam-assignment-results-" + assignmentId + ".xlsx")
                        .build()
                        .toString())
                .body(body);
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ExamAssignmentResponse>> create(
            @RequestBody CreateExamAssignmentRequest request,
            Authentication authentication
    ) {
        ExamAssignmentResponse response = assignmentService.create(request, actor(authentication));
        auditLogService.record(
                "EXAM_ASSIGNMENT_CREATE",
                "EXAM_ASSIGNMENT",
                response.id(),
                actor(authentication),
                "Tạo phân công kiểm tra #" + response.id(),
                Map.of("name", response.name(), "status", response.status(), "targetCount", response.targetCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo phân công kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/{assignmentId}/open")
    public ResponseEntity<ApiResponse<ExamAssignmentResponse>> open(
            @PathVariable Long assignmentId,
            Authentication authentication
    ) {
        ExamAssignmentResponse response = assignmentService.open(assignmentId);
        auditLogService.record(
                "EXAM_ASSIGNMENT_OPEN",
                "EXAM_ASSIGNMENT",
                assignmentId,
                actor(authentication),
                "Mở phân công kiểm tra #" + assignmentId,
                Map.of("name", response.name(), "status", response.status(), "targetCount", response.targetCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Mở phân công kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/{assignmentId}/close")
    public ResponseEntity<ApiResponse<ExamAssignmentResponse>> close(
            @PathVariable Long assignmentId,
            Authentication authentication
    ) {
        ExamAssignmentResponse response = assignmentService.close(assignmentId);
        auditLogService.record(
                "EXAM_ASSIGNMENT_CLOSE",
                "EXAM_ASSIGNMENT",
                assignmentId,
                actor(authentication),
                "Đóng phân công kiểm tra #" + assignmentId,
                Map.of("name", response.name(), "status", response.status(), "targetCount", response.targetCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Đóng phân công kiểm tra thành công",
                response
        ));
    }

    @DeleteMapping("/{assignmentId}")
    public ResponseEntity<ApiResponse<ExamAssignmentResponse>> archive(
            @PathVariable Long assignmentId,
            Authentication authentication
    ) {
        ExamAssignmentResponse response = assignmentService.archive(assignmentId);
        auditLogService.record(
                "EXAM_ASSIGNMENT_ARCHIVE",
                "EXAM_ASSIGNMENT",
                assignmentId,
                actor(authentication),
                "Lưu trữ phân công kiểm tra #" + assignmentId,
                Map.of("name", response.name(), "status", response.status(), "targetCount", response.targetCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ phân công kiểm tra thành công",
                response
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
