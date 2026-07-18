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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionSetCategoryRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetCategoryResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionSetCategoryService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/question-set-categories")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class QuestionSetCategoryController {
    private final QuestionSetCategoryService categoryService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionSetCategoryResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách danh mục bộ câu hỏi thành công",
                categoryService.list(q, status)
        ));
    }

    @GetMapping("/{categoryId}")
    public ResponseEntity<ApiResponse<QuestionSetCategoryResponse>> get(@PathVariable Long categoryId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết danh mục bộ câu hỏi thành công",
                categoryService.get(categoryId)
        ));
    }

    @PostMapping
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetCategoryResponse>> create(
            @Valid @RequestBody UpsertQuestionSetCategoryRequest request,
            Authentication authentication
    ) {
        QuestionSetCategoryResponse response = categoryService.create(request, actor(authentication));
        auditLogService.record(
                "QUESTION_SET_CATEGORY_CREATE",
                "QUESTION_SET_CATEGORY",
                response.id(),
                actor(authentication),
                "Tạo danh mục bộ câu hỏi #" + response.id(),
                Map.of("code", String.valueOf(response.code()), "name", response.name(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo danh mục bộ câu hỏi thành công",
                response
        ));
    }

    @PutMapping("/{categoryId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetCategoryResponse>> update(
            @PathVariable Long categoryId,
            @Valid @RequestBody UpsertQuestionSetCategoryRequest request,
            Authentication authentication
    ) {
        QuestionSetCategoryResponse response = categoryService.update(categoryId, request);
        auditLogService.record(
                "QUESTION_SET_CATEGORY_UPDATE",
                "QUESTION_SET_CATEGORY",
                categoryId,
                actor(authentication),
                "Cập nhật danh mục bộ câu hỏi #" + categoryId,
                Map.of("code", String.valueOf(response.code()), "name", response.name(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật danh mục bộ câu hỏi thành công",
                response
        ));
    }

    @DeleteMapping("/{categoryId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetCategoryResponse>> archive(
            @PathVariable Long categoryId,
            Authentication authentication
    ) {
        QuestionSetCategoryResponse response = categoryService.archive(categoryId);
        auditLogService.record(
                "QUESTION_SET_CATEGORY_ARCHIVE",
                "QUESTION_SET_CATEGORY",
                categoryId,
                actor(authentication),
                "Lưu trữ danh mục bộ câu hỏi #" + categoryId,
                Map.of("code", String.valueOf(response.code()), "name", response.name(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ danh mục bộ câu hỏi thành công",
                response
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
