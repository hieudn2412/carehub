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
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationAuditLogResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/evaluation-audit-logs")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canViewAudit(authentication)")
public class EvaluationAuditLogController {
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EvaluationAuditLogResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String actor
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách audit đánh giá thành công",
                auditLogService.list(q, action, entityType, actor)
        ));
    }

    @GetMapping("/{auditLogId}")
    public ResponseEntity<ApiResponse<EvaluationAuditLogResponse>> get(@PathVariable Long auditLogId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết audit đánh giá thành công",
                auditLogService.get(auditLogId)
        ));
    }
}
