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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.TestQuestionClassificationRuleRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionClassificationRuleRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionClassificationRuleResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionClassificationTestResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionClassificationRuleService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/question-classification-rules")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class QuestionClassificationRuleController {
    private final QuestionClassificationRuleService ruleService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionClassificationRuleResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean enabled
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách quy tắc phân loại thành công",
                ruleService.list(q, enabled)
        ));
    }

    @GetMapping("/{ruleId}")
    public ResponseEntity<ApiResponse<QuestionClassificationRuleResponse>> get(@PathVariable Long ruleId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết quy tắc phân loại thành công",
                ruleService.get(ruleId)
        ));
    }

    @PostMapping
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionClassificationRuleResponse>> create(
            @Valid @RequestBody UpsertQuestionClassificationRuleRequest request,
            Authentication authentication
    ) {
        QuestionClassificationRuleResponse response = ruleService.create(request, actor(authentication));
        auditLogService.record(
                "CLASSIFICATION_RULE_CREATE",
                "QUESTION_CLASSIFICATION_RULE",
                response.id(),
                actor(authentication),
                "Tạo quy tắc phân loại #" + response.id(),
                Map.of(
                        "name", response.name(),
                        "categoryId", String.valueOf(response.categoryId()),
                        "enabled", response.enabled()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo quy tắc phân loại thành công",
                response
        ));
    }

    @PutMapping("/{ruleId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionClassificationRuleResponse>> update(
            @PathVariable Long ruleId,
            @Valid @RequestBody UpsertQuestionClassificationRuleRequest request,
            Authentication authentication
    ) {
        QuestionClassificationRuleResponse response = ruleService.update(ruleId, request);
        auditLogService.record(
                "CLASSIFICATION_RULE_UPDATE",
                "QUESTION_CLASSIFICATION_RULE",
                ruleId,
                actor(authentication),
                "Cập nhật quy tắc phân loại #" + ruleId,
                Map.of(
                        "name", response.name(),
                        "categoryId", String.valueOf(response.categoryId()),
                        "enabled", response.enabled()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật quy tắc phân loại thành công",
                response
        ));
    }

    @DeleteMapping("/{ruleId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionClassificationRuleResponse>> disable(
            @PathVariable Long ruleId,
            Authentication authentication
    ) {
        QuestionClassificationRuleResponse response = ruleService.disable(ruleId);
        auditLogService.record(
                "CLASSIFICATION_RULE_DISABLE",
                "QUESTION_CLASSIFICATION_RULE",
                ruleId,
                actor(authentication),
                "Tạm ngưng quy tắc phân loại #" + ruleId,
                Map.of(
                        "name", response.name(),
                        "categoryId", String.valueOf(response.categoryId()),
                        "enabled", response.enabled()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạm ngưng quy tắc phân loại thành công",
                response
        ));
    }

    @PostMapping("/test")
    public ResponseEntity<ApiResponse<QuestionClassificationTestResponse>> test(
            @RequestBody TestQuestionClassificationRuleRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Kiểm tra quy tắc phân loại thành công",
                ruleService.test(request)
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
