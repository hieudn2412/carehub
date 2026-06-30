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

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DocumentQuestionJobController {
    private final DocumentQuestionJobService jobService;

    @PostMapping("/documents/{documentId}/question-jobs")
    public ResponseEntity<ApiResponse<DocumentQuestionJobResponse>> create(
            @PathVariable Long documentId,
            @Valid @RequestBody(required = false) CreateDocumentQuestionJobRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo phiên sinh câu hỏi thành công",
                jobService.createJob(documentId, request, actor(authentication))
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
    public ResponseEntity<ApiResponse<DocumentQuestionJobResponse>> retryFailedChunks(@PathVariable Long jobId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Retry các chunk lỗi thành công",
                jobService.retryFailedChunks(jobId)
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
