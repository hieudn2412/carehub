package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
import vn.vietduc.carehubbackend.questiongeneration.dto.request.CreateQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.PreviewQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpdateQuestionSetRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetDetailResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionSetSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionSetService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/question-sets")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class QuestionSetController {
    private final QuestionSetService questionSetService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionSetSummaryResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String difficulty,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách bộ câu hỏi thành công",
                questionSetService.list(q, category, difficulty, status)
        ));
    }

    @GetMapping("/{setId}")
    public ResponseEntity<ApiResponse<QuestionSetDetailResponse>> get(@PathVariable Long setId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết bộ câu hỏi thành công",
                questionSetService.get(setId)
        ));
    }

    @GetMapping("/{setId}/export")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<byte[]> export(
            @PathVariable Long setId,
            @RequestParam(defaultValue = "csv") String format,
            Authentication authentication
    ) {
        String normalizedFormat = normalizeExportFormat(format);
        byte[] body = questionSetService.export(setId, normalizedFormat);
        auditLogService.record(
                "QUESTION_SET_EXPORT",
                "QUESTION_SET",
                setId,
                actor(authentication),
                "Export bộ câu hỏi #" + setId,
                Map.of("format", normalizedFormat, "bytes", body.length)
        );
        return ResponseEntity.ok()
                .contentType(exportMediaType(normalizedFormat))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("question-set-" + setId + "." + normalizedFormat)
                        .build()
                        .toString())
                .body(body);
    }

    @PostMapping
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetDetailResponse>> create(
            @RequestBody CreateQuestionSetRequest request,
            Authentication authentication
    ) {
        QuestionSetDetailResponse response = questionSetService.create(request, actor(authentication));
        auditLogService.record(
                "QUESTION_SET_CREATE",
                "QUESTION_SET",
                response.id(),
                actor(authentication),
                "Tạo bộ câu hỏi #" + response.id(),
                Map.of("name", response.name(), "status", response.status(), "questionCount", response.questionCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo bộ câu hỏi thành công",
                response
        ));
    }

    @PutMapping("/{setId}")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetDetailResponse>> update(
            @PathVariable Long setId,
            @RequestBody UpdateQuestionSetRequest request,
            Authentication authentication
    ) {
        QuestionSetDetailResponse response = questionSetService.update(setId, request, actor(authentication));
        auditLogService.record(
                "QUESTION_SET_UPDATE",
                "QUESTION_SET",
                setId,
                actor(authentication),
                "Cập nhật bộ câu hỏi #" + setId,
                Map.of("name", response.name(), "status", response.status(), "questionCount", response.questionCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật bộ câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/{setId}/activate")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetDetailResponse>> activate(
            @PathVariable Long setId,
            Authentication authentication
    ) {
        QuestionSetDetailResponse response = questionSetService.activate(setId, actor(authentication));
        auditLogService.record(
                "QUESTION_SET_ACTIVATE",
                "QUESTION_SET",
                setId,
                actor(authentication),
                "Kích hoạt bộ câu hỏi #" + setId,
                Map.of("name", response.name(), "status", response.status(), "questionCount", response.questionCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Kích hoạt bộ câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/{setId}/deactivate")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetDetailResponse>> deactivate(
            @PathVariable Long setId,
            Authentication authentication
    ) {
        QuestionSetDetailResponse response = questionSetService.deactivate(setId);
        auditLogService.record(
                "QUESTION_SET_DEACTIVATE",
                "QUESTION_SET",
                setId,
                actor(authentication),
                "Tạm ngưng bộ câu hỏi #" + setId,
                Map.of("name", response.name(), "status", response.status(), "questionCount", response.questionCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạm ngưng bộ câu hỏi thành công",
                response
        ));
    }

    @DeleteMapping("/{setId}")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetSummaryResponse>> archive(
            @PathVariable Long setId,
            Authentication authentication
    ) {
        QuestionSetSummaryResponse response = questionSetService.archive(setId);
        auditLogService.record(
                "QUESTION_SET_ARCHIVE",
                "QUESTION_SET",
                setId,
                actor(authentication),
                "Lưu trữ bộ câu hỏi #" + setId,
                Map.of("name", response.name(), "status", response.status(), "questionCount", response.questionCount())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ bộ câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/{setId}/duplicate")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetDetailResponse>> duplicate(
            @PathVariable Long setId,
            Authentication authentication
    ) {
        QuestionSetDetailResponse response = questionSetService.duplicate(setId, actor(authentication));
        auditLogService.record(
                "QUESTION_SET_DUPLICATE",
                "QUESTION_SET",
                response.id(),
                actor(authentication),
                "Nhân bản bộ câu hỏi #" + setId + " thành #" + response.id(),
                Map.of(
                        "sourceSetId", setId,
                        "newSetId", response.id(),
                        "name", response.name(),
                        "questionCount", response.questionCount()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Nhân bản bộ câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/preview")
    @PreAuthorize("@evaluationSecurity.canManageQuestionSet(authentication)")
    public ResponseEntity<ApiResponse<QuestionSetPreviewResponse>> preview(@RequestBody PreviewQuestionSetRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Xem trước bộ câu hỏi thành công",
                questionSetService.preview(request)
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }

    private String normalizeExportFormat(String format) {
        return format == null || format.isBlank() ? "csv" : format.trim().toLowerCase();
    }

    private MediaType exportMediaType(String format) {
        return switch (format) {
            case "pdf" -> MediaType.APPLICATION_PDF;
            case "docx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            case "xlsx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            default -> MediaType.parseMediaType("text/csv; charset=UTF-8");
        };
    }
}
