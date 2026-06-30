package vn.vietduc.carehubbackend.questiongeneration.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateParaphraseJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateParaphraseCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ParaphraseController {
    private final ParaphraseService paraphraseService;

    @PostMapping("/questions/{questionId}/paraphrase-jobs")
    public ResponseEntity<ApiResponse<ParaphraseJobResponse>> createJob(
            @PathVariable Long questionId,
            @Valid @RequestBody(required = false) CreateParaphraseJobRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo phiên diễn đạt lại câu hỏi thành công",
                paraphraseService.createJob(questionId, request, actor(authentication))
        ));
    }

    @GetMapping("/questions/{questionId}/paraphrase-jobs")
    public ResponseEntity<ApiResponse<List<ParaphraseJobResponse>>> listJobs(@PathVariable Long questionId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy lịch sử diễn đạt lại câu hỏi thành công",
                paraphraseService.listJobsByQuestion(questionId)
        ));
    }

    @GetMapping("/paraphrase-jobs/{jobId}")
    public ResponseEntity<ApiResponse<ParaphraseJobResponse>> getJob(@PathVariable Long jobId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết phiên diễn đạt lại thành công",
                paraphraseService.getJob(jobId)
        ));
    }

    @GetMapping("/paraphrase-candidates/{candidateId}")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> getCandidate(@PathVariable Long candidateId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết candidate paraphrase thành công",
                paraphraseService.getCandidate(candidateId)
        ));
    }

    @PatchMapping("/paraphrase-candidates/{candidateId}")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> updateCandidate(
            @PathVariable Long candidateId,
            @Valid @RequestBody UpdateParaphraseCandidateRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật và kiểm tra lại candidate paraphrase thành công",
                paraphraseService.updateCandidate(candidateId, request)
        ));
    }

    @PostMapping("/paraphrase-candidates/{candidateId}/approve")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> approve(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt candidate paraphrase thành công",
                paraphraseService.approve(candidateId, notes(body))
        ));
    }

    @PostMapping("/paraphrase-candidates/{candidateId}/reject")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> reject(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Từ chối candidate paraphrase thành công",
                paraphraseService.reject(candidateId, notes(body))
        ));
    }

    @PostMapping("/paraphrase-candidates/{candidateId}/save-as-question")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> saveAsQuestion(
            @PathVariable Long candidateId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu câu paraphrase vào ngân hàng câu hỏi thành công",
                paraphraseService.saveAsQuestion(candidateId, actor(authentication))
        ));
    }

    private String notes(Map<String, String> body) {
        return body == null ? null : body.get("reviewerNotes");
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
