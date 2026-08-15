package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateEvaluationAudienceRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.EvaluationAudiencePreviewRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationAudiencePreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationAudienceResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAudienceService;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationCutoverService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/evaluation-audiences")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canManageAssignment(authentication)")
public class EvaluationAudienceController {
    private final EvaluationAudienceService service;
    private final EvaluationCutoverService cutover;

    @PostMapping("/preview")
    public ResponseEntity<ApiResponse<EvaluationAudiencePreviewResponse>> preview(@RequestBody EvaluationAudiencePreviewRequest request) {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Preview đối tượng thi thành công", service.preview(request == null ? null : request.ruleJson())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<EvaluationAudienceResponse>>> list() {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Lấy danh sách đối tượng thi thành công", service.list()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EvaluationAudienceResponse>> get(@PathVariable Long id) {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Lấy đối tượng thi thành công", service.get(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EvaluationAudienceResponse>> create(@RequestBody CreateEvaluationAudienceRequest request, Authentication authentication) {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Tạo đối tượng thi thành công", service.create(request, actor(authentication))));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EvaluationAudienceResponse>> update(@PathVariable Long id, @RequestBody CreateEvaluationAudienceRequest request, Authentication authentication) {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Cập nhật đối tượng thi thành công", service.update(id, request, actor(authentication))));
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<ApiResponse<EvaluationAudienceResponse>> activate(@PathVariable Long id) {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Kích hoạt đối tượng thi thành công", service.activate(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<EvaluationAudienceResponse>> archive(@PathVariable Long id) {
        cutover.requireAudienceRules();
        return ResponseEntity.ok(ApiResponse.success("Lưu trữ đối tượng thi thành công", service.archive(id)));
    }

    private String actor(Authentication authentication) { return authentication == null ? "system" : authentication.getName(); }
}
