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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.BatchParaphraseCandidateActionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateBatchParaphraseJobsRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateParaphraseJobRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateParaphraseCandidateRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.BatchParaphraseCandidateActionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.BatchParaphraseJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseCandidateResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ParaphraseJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.paraphrase.ParaphraseService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class ParaphraseController {
    private final ParaphraseService paraphraseService;
    private final EvaluationAuditLogService auditLogService;

    @PostMapping("/questions/{questionId}/paraphrase-jobs")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<ParaphraseJobResponse>> createJob(
            @PathVariable Long questionId,
            @Valid @RequestBody(required = false) CreateParaphraseJobRequest request,
            Authentication authentication
    ) {
        ParaphraseJobResponse response = paraphraseService.createJob(questionId, request, actor(authentication));
        auditLogService.record(
                "PARAPHRASE_JOB_CREATE",
                "PARAPHRASE_JOB",
                response.id(),
                actor(authentication),
                "Tạo phiên diễn đạt lại từ câu hỏi #" + questionId,
                Map.of("sourceQuestionId", questionId, "requestedCount", response.requestedCount(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo phiên diễn đạt lại câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-jobs/batch")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<BatchParaphraseJobResponse>> createBatchJobs(
            @Valid @RequestBody CreateBatchParaphraseJobsRequest request,
            Authentication authentication
    ) {
        BatchParaphraseJobResponse response = paraphraseService.createBatchJobs(request, actor(authentication));
        auditLogService.record(
                "PARAPHRASE_JOB_BATCH_CREATE",
                "PARAPHRASE_JOB",
                null,
                actor(authentication),
                "Tạo hàng loạt phiên diễn đạt lại",
                Map.of(
                        "requestedQuestionCount", response.requestedQuestionCount(),
                        "succeededCount", response.succeededCount(),
                        "failedCount", response.failedCount()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo hàng loạt phiên diễn đạt lại thành công",
                response
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
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> updateCandidate(
            @PathVariable Long candidateId,
            @Valid @RequestBody UpdateParaphraseCandidateRequest request,
            Authentication authentication
    ) {
        ParaphraseCandidateResponse response = paraphraseService.updateCandidate(candidateId, request);
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_UPDATE",
                "PARAPHRASE_CANDIDATE",
                candidateId,
                actor(authentication),
                "Cập nhật candidate paraphrase #" + candidateId,
                Map.of("jobId", response.jobId(), "sourceQuestionId", response.sourceQuestionId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật và kiểm tra lại candidate paraphrase thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-candidates/{candidateId}/approve")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> approve(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        ParaphraseCandidateResponse response = paraphraseService.approve(candidateId, notes(body));
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_APPROVE",
                "PARAPHRASE_CANDIDATE",
                candidateId,
                actor(authentication),
                "Duyệt candidate paraphrase #" + candidateId,
                Map.of("jobId", response.jobId(), "sourceQuestionId", response.sourceQuestionId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt candidate paraphrase thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-candidates/{candidateId}/reject")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> reject(
            @PathVariable Long candidateId,
            @RequestBody(required = false) Map<String, String> body,
            Authentication authentication
    ) {
        ParaphraseCandidateResponse response = paraphraseService.reject(candidateId, notes(body));
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_REJECT",
                "PARAPHRASE_CANDIDATE",
                candidateId,
                actor(authentication),
                "Từ chối candidate paraphrase #" + candidateId,
                Map.of("jobId", response.jobId(), "sourceQuestionId", response.sourceQuestionId(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Từ chối candidate paraphrase thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-candidates/{candidateId}/save-as-question")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<ParaphraseCandidateResponse>> saveAsQuestion(
            @PathVariable Long candidateId,
            Authentication authentication
    ) {
        ParaphraseCandidateResponse response = paraphraseService.saveAsQuestion(candidateId, actor(authentication));
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_SAVE",
                "PARAPHRASE_CANDIDATE",
                candidateId,
                actor(authentication),
                "Lưu candidate paraphrase #" + candidateId + " vào ngân hàng",
                Map.of(
                        "jobId", response.jobId(),
                        "sourceQuestionId", response.sourceQuestionId(),
                        "status", response.status(),
                        "savedQuestionId", String.valueOf(response.savedQuestionId())
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu câu paraphrase vào ngân hàng câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-candidates/batch/approve")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<BatchParaphraseCandidateActionResponse>> approveBatch(
            @RequestBody BatchParaphraseCandidateActionRequest request,
            Authentication authentication
    ) {
        BatchParaphraseCandidateActionResponse response = paraphraseService.approveBatch(request);
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_BATCH_APPROVE",
                "PARAPHRASE_CANDIDATE",
                null,
                actor(authentication),
                "Duyệt hàng loạt candidate paraphrase",
                Map.of("requestedCount", response.requestedCount(), "succeededCount", response.succeededCount(), "failedCount", response.failedCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt hàng loạt candidate paraphrase thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-candidates/batch/reject")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<BatchParaphraseCandidateActionResponse>> rejectBatch(
            @RequestBody BatchParaphraseCandidateActionRequest request,
            Authentication authentication
    ) {
        BatchParaphraseCandidateActionResponse response = paraphraseService.rejectBatch(request);
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_BATCH_REJECT",
                "PARAPHRASE_CANDIDATE",
                null,
                actor(authentication),
                "Từ chối hàng loạt candidate paraphrase",
                Map.of("requestedCount", response.requestedCount(), "succeededCount", response.succeededCount(), "failedCount", response.failedCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Từ chối hàng loạt candidate paraphrase thành công",
                response
        ));
    }

    @PostMapping("/paraphrase-candidates/batch/save-as-questions")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<BatchParaphraseCandidateActionResponse>> saveBatch(
            @RequestBody BatchParaphraseCandidateActionRequest request,
            Authentication authentication
    ) {
        BatchParaphraseCandidateActionResponse response = paraphraseService.saveBatch(request, actor(authentication));
        auditLogService.record(
                "PARAPHRASE_CANDIDATE_BATCH_SAVE",
                "PARAPHRASE_CANDIDATE",
                null,
                actor(authentication),
                "Lưu hàng loạt candidate paraphrase vào ngân hàng",
                Map.of("requestedCount", response.requestedCount(), "succeededCount", response.succeededCount(), "failedCount", response.failedCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu hàng loạt candidate paraphrase vào ngân hàng câu hỏi thành công",
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
