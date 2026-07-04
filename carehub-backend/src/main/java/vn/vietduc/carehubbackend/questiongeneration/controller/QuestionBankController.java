package vn.vietduc.carehubbackend.questiongeneration.controller;

import jakarta.validation.Valid;
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
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.QuestionBankImportCommitRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.UpsertQuestionBankQuestionRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportCommitResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankImportPreviewResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.QuestionBankQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionBankImportExportService;
import vn.vietduc.carehubbackend.questiongeneration.service.QuestionBankService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/questions")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class QuestionBankController {
    private final QuestionBankService questionBankService;
    private final QuestionBankImportExportService importExportService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<QuestionBankQuestionResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách câu hỏi thành công",
                questionBankService.list(q, status)
        ));
    }

    @GetMapping("/{questionId}")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> get(@PathVariable Long questionId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết câu hỏi thành công",
                questionBankService.get(questionId)
        ));
    }

    @GetMapping("/export")
    @PreAuthorize("@evaluationSecurity.hasAny(authentication, 'QUESTION_AUTHOR', 'QUESTION_REVIEWER', 'QUESTION_SET_MANAGER')")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            Authentication authentication
    ) {
        byte[] body = importExportService.exportXlsx(q, status);
        auditLogService.record(
                "QUESTION_EXPORT",
                "QUESTION_BANK",
                null,
                actor(authentication),
                "Export ngân hàng câu hỏi",
                Map.of("q", String.valueOf(q), "status", String.valueOf(status), "bytes", body.length)
        );
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("question-bank.xlsx")
                        .build()
                        .toString())
                .body(body);
    }

    @GetMapping("/import/template")
    @PreAuthorize("@evaluationSecurity.hasAny(authentication, 'QUESTION_AUTHOR', 'QUESTION_REVIEWER')")
    public ResponseEntity<byte[]> importTemplate(Authentication authentication) {
        byte[] body = importExportService.importTemplateXlsx();
        auditLogService.record(
                "QUESTION_IMPORT_TEMPLATE_DOWNLOAD",
                "QUESTION_BANK",
                null,
                actor(authentication),
                "Tải file mẫu import ngân hàng câu hỏi",
                Map.of("format", "xlsx", "bytes", body.length)
        );
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("question-bank-import-template.xlsx")
                        .build()
                        .toString())
                .body(body);
    }

    @PostMapping(value = "/import/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<QuestionBankImportPreviewResponse>> previewImport(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "columnMapping", required = false) String columnMapping,
            Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Preview import ngân hàng câu hỏi thành công",
                importExportService.preview(file, actor(authentication), columnMapping)
        ));
    }

    @PostMapping("/import/commit")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionBankImportCommitResponse>> commitImport(
            @RequestBody QuestionBankImportCommitRequest request,
            Authentication authentication
    ) {
        QuestionBankImportCommitResponse response = importExportService.commit(request, actor(authentication));
        auditLogService.record(
                "QUESTION_IMPORT_COMMIT",
                "QUESTION_BANK",
                null,
                actor(authentication),
                "Import ngân hàng câu hỏi",
                Map.of(
                        "totalRows", response.totalRows(),
                        "createdCount", response.createdCount(),
                        "skippedCount", response.skippedCount(),
                        "failedCount", response.failedCount()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Import ngân hàng câu hỏi thành công",
                response
        ));
    }

    @PostMapping
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> create(
            @Valid @RequestBody UpsertQuestionBankQuestionRequest request,
            Authentication authentication
    ) {
        QuestionBankQuestionResponse response = questionBankService.create(request, actor(authentication));
        auditLogService.record(
                "QUESTION_CREATE",
                "QUESTION",
                response.id(),
                actor(authentication),
                "Tạo câu hỏi #" + response.id(),
                Map.of("status", response.status(), "topic", String.valueOf(response.topic()), "difficulty", String.valueOf(response.difficulty()))
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạo câu hỏi thành công",
                response
        ));
    }

    @PutMapping("/{questionId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> update(
            @PathVariable Long questionId,
            @Valid @RequestBody UpsertQuestionBankQuestionRequest request,
            Authentication authentication
    ) {
        QuestionBankQuestionResponse response = questionBankService.update(questionId, request, actor(authentication));
        auditLogService.record(
                "QUESTION_UPDATE",
                "QUESTION",
                questionId,
                actor(authentication),
                "Cập nhật câu hỏi #" + questionId,
                Map.of("status", response.status(), "topic", String.valueOf(response.topic()), "difficulty", String.valueOf(response.difficulty()))
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Cập nhật câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/{questionId}/approve")
    @PreAuthorize("@evaluationSecurity.canReview(authentication)")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> approve(
            @PathVariable Long questionId,
            Authentication authentication
    ) {
        QuestionBankQuestionResponse response = questionBankService.approve(questionId, actor(authentication));
        auditLogService.record(
                "QUESTION_APPROVE",
                "QUESTION",
                questionId,
                actor(authentication),
                "Duyệt câu hỏi #" + questionId,
                Map.of("status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Duyệt câu hỏi thành công",
                response
        ));
    }

    @PostMapping("/{questionId}/deactivate")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> deactivate(
            @PathVariable Long questionId,
            Authentication authentication
    ) {
        QuestionBankQuestionResponse response = questionBankService.deactivate(questionId);
        auditLogService.record(
                "QUESTION_DEACTIVATE",
                "QUESTION",
                questionId,
                actor(authentication),
                "Tạm ngưng câu hỏi #" + questionId,
                Map.of("status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Tạm ngưng câu hỏi thành công",
                response
        ));
    }

    @DeleteMapping("/{questionId}")
    @PreAuthorize("@evaluationSecurity.canAuthor(authentication)")
    public ResponseEntity<ApiResponse<QuestionBankQuestionResponse>> archive(
            @PathVariable Long questionId,
            Authentication authentication
    ) {
        QuestionBankQuestionResponse response = questionBankService.archive(questionId);
        auditLogService.record(
                "QUESTION_ARCHIVE",
                "QUESTION",
                questionId,
                actor(authentication),
                "Lưu trữ câu hỏi #" + questionId,
                Map.of("status", response.status())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ câu hỏi thành công",
                response
        ));
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }
}
