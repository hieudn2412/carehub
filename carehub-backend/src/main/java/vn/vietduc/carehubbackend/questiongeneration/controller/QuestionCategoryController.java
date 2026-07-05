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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionCategoryRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionCategoryResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionCategoryService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/question-categories")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class QuestionCategoryController {
    private final QuestionCategoryService categoryService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionCategoryResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách danh mục câu hỏi thành công",
                categoryService.list(q, status)
        ));
    }

    @GetMapping("/{categoryId}")
    public ResponseEntity<ApiResponse<QuestionCategoryResponse>> get(@PathVariable Long categoryId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết danh mục câu hỏi thành công",
                categoryService.get(categoryId)
        ));
    }

    @PostMapping
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionCategoryResponse>> create(
            @Valid @RequestBody UpsertQuestionCategoryRequest request,
            Authentication authentication
    ) {
        QuestionCategoryResponse response = categoryService.create(request, actor(authentication));
        auditLogService.record(
                "QUESTION_CATEGORY_CREATE",
                "QUESTION_CATEGORY",
                response.id(),
                actor(authentication),
                "Tạo danh mục câu hỏi #" + response.id(),
                Map.of("code", String.valueOf(response.code()), "name", response.name(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo danh mục câu hỏi thành công",
                response
        ));
    }

    @PutMapping("/{categoryId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionCategoryResponse>> update(
            @PathVariable Long categoryId,
            @Valid @RequestBody UpsertQuestionCategoryRequest request,
            Authentication authentication
    ) {
        QuestionCategoryResponse response = categoryService.update(categoryId, request);
        auditLogService.record(
                "QUESTION_CATEGORY_UPDATE",
                "QUESTION_CATEGORY",
                categoryId,
                actor(authentication),
                "Cập nhật danh mục câu hỏi #" + categoryId,
                Map.of("code", String.valueOf(response.code()), "name", response.name(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật danh mục câu hỏi thành công",
                response
        ));
    }

    @DeleteMapping("/{categoryId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionCategoryResponse>> archive(
            @PathVariable Long categoryId,
            Authentication authentication
    ) {
        QuestionCategoryResponse response = categoryService.archive(categoryId);
        auditLogService.record(
                "QUESTION_CATEGORY_ARCHIVE",
                "QUESTION_CATEGORY",
                categoryId,
                actor(authentication),
                "Lưu trữ danh mục câu hỏi #" + categoryId,
                Map.of("code", String.valueOf(response.code()), "name", response.name(), "status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ danh mục câu hỏi thành công",
                response
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
