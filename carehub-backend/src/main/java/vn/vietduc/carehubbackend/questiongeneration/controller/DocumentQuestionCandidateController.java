package vn.vietduc.carehubbackend.questiongeneration.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.BatchDocumentQuestionCandidateActionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateDocumentQuestionCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.BatchDocumentQuestionCandidateActionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.CandidateReviewService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;

import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/document-question-candidates")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canReview(authentication)")
public class DocumentQuestionCandidateController {
    private final CandidateReviewService candidateReviewService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping("/{candidateId}")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> get(@PathVariable Long candidateId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết câu hỏi đề xuất thành công",
                candidateReviewService.get(candidateId)
        ));
    }

    @PutMapping("/{candidateId}")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> update(
            @PathVariable Long candidateId,
            @Valid @RequestBody UpdateDocumentQuestionCandidateRequest request,
            Authentication authentication
    ) {
        DocumentQuestionCandidateResponse response = candidateReviewService.update(candidateId, request);
        auditLogService.record(
                "DOCUMENT_CANDIDATE_UPDATE",
                "DOCUMENT_QUESTION_CANDIDATE",
                candidateId,
                actor(authentication),
                "Cập nhật câu hỏi đề xuất #" + candidateId,
                Map.of("jobId", response.jobId(), "documentId", response.documentId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật và kiểm tra lại câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/{candidateId}/approve")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> approve(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        DocumentQuestionCandidateResponse response = candidateReviewService.approve(candidateId, notes(body));
        auditLogService.record(
                "DOCUMENT_CANDIDATE_APPROVE",
                "DOCUMENT_QUESTION_CANDIDATE",
                candidateId,
                actor(authentication),
                "Duyệt câu hỏi đề xuất #" + candidateId,
                Map.of("jobId", response.jobId(), "documentId", response.documentId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt câu hỏi đề xuất thành công",
                response
        ));
    }

    @PostMapping("/{candidateId}/reject")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> reject(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        DocumentQuestionCandidateResponse response = candidateReviewService.reject(candidateId, notes(body));
        auditLogService.record(
                "DOCUMENT_CANDIDATE_REJECT",
                "DOCUMENT_QUESTION_CANDIDATE",
                candidateId,
                actor(authentication),
                "Từ chối câu hỏi đề xuất #" + candidateId,
                Map.of("jobId", response.jobId(), "documentId", response.documentId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Từ chối câu hỏi đề xuất thành công",
                response
        ));
    }

    @PostMapping("/{candidateId}/save-as-question")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> saveAsQuestion(
            @PathVariable Long candidateId,
            Authentication authentication
    ) {
        DocumentQuestionCandidateResponse response = candidateReviewService.saveAsQuestion(candidateId, actor(authentication));
        auditLogService.record(
                "DOCUMENT_CANDIDATE_SAVE",
                "DOCUMENT_QUESTION_CANDIDATE",
                candidateId,
                actor(authentication),
                "Lưu câu hỏi đề xuất #" + candidateId + " vào ngân hàng",
                Map.of(
                        "jobId", response.jobId(),
                        "documentId", response.documentId(),
                        "status", response.status(),
                        "savedQuestionId", String.valueOf(response.savedQuestionId())
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu câu hỏi vào ngân hàng câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/batch/approve")
    public ResponseEntity<ApiResponse<BatchDocumentQuestionCandidateActionResponse>> approveBatch(
            @RequestBody BatchDocumentQuestionCandidateActionRequest request,
            Authentication authentication
    ) {
        BatchDocumentQuestionCandidateActionResponse response = candidateReviewService.approveBatch(request);
        auditLogService.record(
                "DOCUMENT_CANDIDATE_BATCH_APPROVE",
                "DOCUMENT_QUESTION_CANDIDATE",
                null,
                actor(authentication),
                "Duyệt hàng loạt câu hỏi đề xuất",
                Map.of("requestedCount", response.requestedCount(), "succeededCount", response.succeededCount(), "failedCount", response.failedCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt hàng loạt câu hỏi đề xuất thành công",
                response
        ));
    }

    @PostMapping("/batch/reject")
    public ResponseEntity<ApiResponse<BatchDocumentQuestionCandidateActionResponse>> rejectBatch(
            @RequestBody BatchDocumentQuestionCandidateActionRequest request,
            Authentication authentication
    ) {
        BatchDocumentQuestionCandidateActionResponse response = candidateReviewService.rejectBatch(request);
        auditLogService.record(
                "DOCUMENT_CANDIDATE_BATCH_REJECT",
                "DOCUMENT_QUESTION_CANDIDATE",
                null,
                actor(authentication),
                "Từ chối hàng loạt câu hỏi đề xuất",
                Map.of("requestedCount", response.requestedCount(), "succeededCount", response.succeededCount(), "failedCount", response.failedCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Từ chối hàng loạt câu hỏi đề xuất thành công",
                response
        ));
    }

    @PostMapping("/batch/save-as-questions")
    public ResponseEntity<ApiResponse<BatchDocumentQuestionCandidateActionResponse>> saveBatch(
            @RequestBody BatchDocumentQuestionCandidateActionRequest request,
            Authentication authentication
    ) {
        BatchDocumentQuestionCandidateActionResponse response = candidateReviewService.saveBatch(request, actor(authentication));
        auditLogService.record(
                "DOCUMENT_CANDIDATE_BATCH_SAVE",
                "DOCUMENT_QUESTION_CANDIDATE",
                null,
                actor(authentication),
                "Lưu hàng loạt câu hỏi đề xuất vào ngân hàng",
                Map.of("requestedCount", response.requestedCount(), "succeededCount", response.succeededCount(), "failedCount", response.failedCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu hàng loạt câu hỏi vào ngân hàng câu hỏi thành công",
                response
        ));
    }

    private String notes(Map<String, String> body) {
        return body == null ? null : body.get("reviewerNotes");
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
