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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateDocumentQuestionCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DocumentQuestionCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.CandidateReviewService;

import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/document-question-candidates")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DocumentQuestionCandidateController {
    private final CandidateReviewService candidateReviewService;

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
            @Valid @RequestBody UpdateDocumentQuestionCandidateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật và kiểm tra lại câu hỏi thành công",
                candidateReviewService.update(candidateId, request)
        ));
    }

    @PostMapping("/{candidateId}/approve")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> approve(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt câu hỏi đề xuất thành công",
                candidateReviewService.approve(candidateId, notes(body))
        ));
    }

    @PostMapping("/{candidateId}/reject")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> reject(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Từ chối câu hỏi đề xuất thành công",
                candidateReviewService.reject(candidateId, notes(body))
        ));
    }

    @PostMapping("/{candidateId}/save-as-question")
    public ResponseEntity<ApiResponse<DocumentQuestionCandidateResponse>> saveAsQuestion(
            @PathVariable Long candidateId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu câu hỏi vào ngân hàng câu hỏi thành công",
                candidateReviewService.saveAsQuestion(candidateId, actor(authentication))
        ));
    }

    private String notes(Map<String, String> body) {
        return body == null ? null : body.get("reviewerNotes");
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
