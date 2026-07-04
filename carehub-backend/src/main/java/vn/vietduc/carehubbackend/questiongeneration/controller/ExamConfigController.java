package vn.vietduc.carehubbackend.questiongeneration.controller;

import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertExamConfigRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamConfigResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamConfigService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/exam-configs")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class ExamConfigController {
    private final ExamConfigService examConfigService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamConfigResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách cấu hình đề kiểm tra thành công",
                examConfigService.list(q, status)
        ));
    }

    @GetMapping("/{configId}")
    public ResponseEntity<ApiResponse<ExamConfigResponse>> get(@PathVariable Long configId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết cấu hình đề kiểm tra thành công",
                examConfigService.get(configId)
        ));
    }

    @PostMapping
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigResponse>> create(
            @Valid @RequestBody UpsertExamConfigRequest request,
            Authentication authentication
    ) {
        ExamConfigResponse response = examConfigService.create(request, actor(authentication));
        auditLogService.record(
                "EXAM_CONFIG_CREATE",
                "EXAM_CONFIG",
                response.id(),
                actor(authentication),
                "Tạo cấu hình đề kiểm tra #" + response.id(),
                Map.of("name", response.name(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo cấu hình đề kiểm tra thành công",
                response
        ));
    }

    @PutMapping("/{configId}")
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigResponse>> update(
            @PathVariable Long configId,
            @Valid @RequestBody UpsertExamConfigRequest request,
            Authentication authentication
    ) {
        ExamConfigResponse response = examConfigService.update(configId, request, actor(authentication));
        auditLogService.record(
                "EXAM_CONFIG_UPDATE",
                "EXAM_CONFIG",
                configId,
                actor(authentication),
                "Cập nhật cấu hình đề kiểm tra #" + configId,
                Map.of("name", response.name(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật cấu hình đề kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/{configId}/activate")
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigResponse>> activate(
            @PathVariable Long configId,
            Authentication authentication
    ) {
        ExamConfigResponse response = examConfigService.activate(configId, actor(authentication));
        auditLogService.record(
                "EXAM_CONFIG_ACTIVATE",
                "EXAM_CONFIG",
                configId,
                actor(authentication),
                "Kích hoạt cấu hình đề kiểm tra #" + configId,
                Map.of("name", response.name(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Kích hoạt cấu hình đề kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/{configId}/deactivate")
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigResponse>> deactivate(
            @PathVariable Long configId,
            Authentication authentication
    ) {
        ExamConfigResponse response = examConfigService.deactivate(configId);
        auditLogService.record(
                "EXAM_CONFIG_DEACTIVATE",
                "EXAM_CONFIG",
                configId,
                actor(authentication),
                "Tạm ngưng cấu hình đề kiểm tra #" + configId,
                Map.of("name", response.name(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạm ngưng cấu hình đề kiểm tra thành công",
                response
        ));
    }

    @DeleteMapping("/{configId}")
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigResponse>> archive(
            @PathVariable Long configId,
            Authentication authentication
    ) {
        ExamConfigResponse response = examConfigService.archive(configId);
        auditLogService.record(
                "EXAM_CONFIG_ARCHIVE",
                "EXAM_CONFIG",
                configId,
                actor(authentication),
                "Lưu trữ cấu hình đề kiểm tra #" + configId,
                Map.of("name", response.name(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ cấu hình đề kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/preview")
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigPreviewResponse>> preview(@RequestBody UpsertExamConfigRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Xem trước cấu hình đề kiểm tra thành công",
                examConfigService.preview(request)
        ));
    }

    @PostMapping("/{configId}/preview")
    @PreAuthorize("@evaluationSecurity.canManageExamConfig(authentication)")
    public ResponseEntity<ApiResponse<ExamConfigPreviewResponse>> previewExisting(@PathVariable Long configId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Xem trước cấu hình đề kiểm tra thành công",
                examConfigService.previewExisting(configId)
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
