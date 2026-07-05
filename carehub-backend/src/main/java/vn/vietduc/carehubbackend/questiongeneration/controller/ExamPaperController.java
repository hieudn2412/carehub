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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamPaperResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationAuditLogService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamPaperService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("${app.api-prefix}/exam-papers")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.canAccess(authentication)")
public class ExamPaperController {
    private final ExamPaperService examPaperService;
    private final EvaluationAuditLogService auditLogService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ExamPaperResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy danh sách bộ đề kiểm tra thành công",
                examPaperService.list(q, status)
        ));
    }

    @GetMapping("/{paperId}")
    public ResponseEntity<ApiResponse<ExamPaperResponse>> get(@PathVariable Long paperId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết bộ đề kiểm tra thành công",
                examPaperService.get(paperId)
        ));
    }

    @PostMapping("/generate")
    @PreAuthorize("@evaluationSecurity.canPublishExam(authentication)")
    public ResponseEntity<ApiResponse<List<ExamPaperResponse>>> generate(
            @RequestBody GenerateExamPaperRequest request,
            Authentication authentication
    ) {
        List<ExamPaperResponse> response = examPaperService.generate(request, actor(authentication));
        auditLogService.record(
                "EXAM_PAPER_GENERATE",
                "EXAM_PAPER",
                null,
                actor(authentication),
                "Sinh bộ đề kiểm tra",
                Map.of(
                        "generatedCount", response.size(),
                        "paperIds", response.stream().map(ExamPaperResponse::id).toList(),
                        "examConfigId", String.valueOf(request == null ? null : request.examConfigId())
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Sinh bộ đề kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/{paperId}/publish")
    @PreAuthorize("@evaluationSecurity.canPublishExam(authentication)")
    public ResponseEntity<ApiResponse<ExamPaperResponse>> publish(
            @PathVariable Long paperId,
            Authentication authentication
    ) {
        ExamPaperResponse response = examPaperService.publish(paperId, actor(authentication));
        auditLogService.record(
                "EXAM_PAPER_PUBLISH",
                "EXAM_PAPER",
                paperId,
                actor(authentication),
                "Phát hành bộ đề kiểm tra #" + paperId,
                Map.of("code", response.code(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Phát hành bộ đề kiểm tra thành công",
                response
        ));
    }

    @DeleteMapping("/{paperId}")
    @PreAuthorize("@evaluationSecurity.canPublishExam(authentication)")
    public ResponseEntity<ApiResponse<ExamPaperResponse>> archive(
            @PathVariable Long paperId,
            Authentication authentication
    ) {
        ExamPaperResponse response = examPaperService.archive(paperId);
        auditLogService.record(
                "EXAM_PAPER_ARCHIVE",
                "EXAM_PAPER",
                paperId,
                actor(authentication),
                "Lưu trữ bộ đề kiểm tra #" + paperId,
                Map.of("code", response.code(), "status", response.status(), "totalQuestions", response.totalQuestions())
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Lưu trữ bộ đề kiểm tra thành công",
                response
        ));
    }

    @PostMapping("/{paperId}/duplicate")
    @PreAuthorize("@evaluationSecurity.canPublishExam(authentication)")
    public ResponseEntity<ApiResponse<ExamPaperResponse>> duplicate(
            @PathVariable Long paperId,
            Authentication authentication
    ) {
        ExamPaperResponse response = examPaperService.duplicate(paperId, actor(authentication));
        auditLogService.record(
                "EXAM_PAPER_DUPLICATE",
                "EXAM_PAPER",
                response.id(),
                actor(authentication),
                "Nhân bản bộ đề #" + paperId + " thành #" + response.id(),
                Map.of(
                        "sourcePaperId", paperId,
                        "newPaperId", response.id(),
                        "code", response.code(),
                        "status", response.status(),
                        "totalQuestions", response.totalQuestions()
                )
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Nhân bản bộ đề kiểm tra thành công",
                response
        ));
    }

    @GetMapping("/{paperId}/export")
    @PreAuthorize("@evaluationSecurity.canPublishExam(authentication)")
    public ResponseEntity<byte[]> export(
            @PathVariable Long paperId,
            @RequestParam(defaultValue = "false") boolean includeAnswers,
            @RequestParam(defaultValue = "txt") String format,
            Authentication authentication
    ) {
        String normalizedFormat = normalizeExportFormat(format);
        byte[] body = examPaperService.export(paperId, normalizedFormat, includeAnswers);
        auditLogService.record(
                "EXAM_PAPER_EXPORT",
                "EXAM_PAPER",
                paperId,
                actor(authentication),
                includeAnswers ? "Export đáp án bộ đề #" + paperId : "Export bộ đề #" + paperId,
                Map.of("includeAnswers", includeAnswers, "format", normalizedFormat, "bytes", body.length)
        );
        String filename = includeAnswers
                ? "exam-paper-answer-key-" + paperId + "." + normalizedFormat
                : "exam-paper-" + paperId + "." + normalizedFormat;
        return ResponseEntity.ok()
                .contentType(exportMediaType(normalizedFormat))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename)
                        .build()
                        .toString())
                .body(body);
    }

    private String actor(Authentication authentication) {
        return authentication == null ? "system" : authentication.getName();
    }

    private String normalizeExportFormat(String format) {
        return format == null || format.isBlank() ? "txt" : format.trim().toLowerCase();
    }

    private MediaType exportMediaType(String format) {
        return switch (format) {
            case "pdf" -> MediaType.APPLICATION_PDF;
            case "docx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            case "xlsx" -> MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            default -> MediaType.parseMediaType("text/plain; charset=UTF-8");
        };
    }
}
