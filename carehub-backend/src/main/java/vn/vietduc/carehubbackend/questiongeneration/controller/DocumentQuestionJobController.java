package vn.vietduc.carehubbackend.questiongeneration.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateDocumentQuestionJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.DocumentQuestionJobService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class DocumentQuestionJobController {
    private final DocumentQuestionJobService jobService;
    private final EvaluationAuditLogService auditLogService;

    @PostMapping("/documents/{documentId}/question-jobs")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<DocumentQuestionJobResponse>> create(
            @PathVariable Long documentId,
            @Valid @RequestBody(required = false) CreateDocumentQuestionJobRequest request,
            Authentication authentication
    ) {
        DocumentQuestionJobResponse response = jobService.createJob(documentId, request, actor(authentication));
        auditLogService.record(
                "DOCUMENT_JOB_CREATE",
                "DOCUMENT_QUESTION_JOB",
                response.id(),
                actor(authentication),
                "Tạo phiên sinh câu hỏi từ tài liệu #" + documentId,
                Map.of(
                        "documentId", documentId,
                        "status", response.status(),
                        "questionsPerChunk", response.questionsPerChunk(),
                        "chunkCount", response.chunkCount()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo phiên sinh câu hỏi thành công",
                response
        ));
    }

    @GetMapping("/documents/{documentId}/question-jobs")
    public ResponseEntity<ApiResponse<List<DocumentQuestionJobResponse>>> listByDocument(@PathVariable Long documentId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy lịch sử phiên sinh câu hỏi thành công",
                jobService.listByDocument(documentId)
        ));
    }

    @GetMapping("/document-question-jobs/{jobId}")
    public ResponseEntity<ApiResponse<DocumentQuestionJobResponse>> get(@PathVariable Long jobId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết phiên sinh câu hỏi thành công",
                jobService.get(jobId)
        ));
    }

    @PostMapping("/document-question-jobs/{jobId}/retry-failed-chunks")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<DocumentQuestionJobResponse>> retryFailedChunks(
            @PathVariable Long jobId,
            Authentication authentication
    ) {
        DocumentQuestionJobResponse response = jobService.retryFailedChunks(jobId);
        auditLogService.record(
                "DOCUMENT_JOB_RETRY",
                "DOCUMENT_QUESTION_JOB",
                jobId,
                actor(authentication),
                "Retry các chunk lỗi của phiên sinh câu hỏi #" + jobId,
                Map.of("documentId", response.documentId(), "status", response.status(), "failedChunkCount", response.failedChunkCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Retry các chunk lỗi thành công",
                response
        ));
    }

    @PostMapping("/document-question-jobs/{jobId}/cancel")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<DocumentQuestionJobResponse>> cancel(
            @PathVariable Long jobId,
            Authentication authentication
    ) {
        DocumentQuestionJobResponse response = jobService.cancel(jobId);
        auditLogService.record(
                "DOCUMENT_JOB_CANCEL",
                "DOCUMENT_QUESTION_JOB",
                jobId,
                actor(authentication),
                "Hủy phiên sinh câu hỏi #" + jobId,
                Map.of("documentId", response.documentId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Hủy phiên tạo câu hỏi thành công",
                response
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
