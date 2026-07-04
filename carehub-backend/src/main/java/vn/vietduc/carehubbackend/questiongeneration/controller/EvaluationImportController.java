package vn.vietduc.carehubbackend.questiongeneration.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationImportJobResponse;
import vn.vietduc.carehubbackend.questiongeneration.service.EvaluationImportHistoryService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/evaluation-imports")
@RequiredArgsConstructor
@PreAuthorize("@evaluationSecurity.hasAny(authentication, 'QUESTION_AUTHOR', 'QUESTION_REVIEWER')")
public class EvaluationImportController {
    private final EvaluationImportHistoryService importHistoryService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EvaluationImportJobResponse>>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String importType
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy lịch sử import đánh giá thành công",
                importHistoryService.list(q, status, importType)
        ));
    }

    @GetMapping("/{importJobId}")
    public ResponseEntity<ApiResponse<EvaluationImportJobResponse>> get(@PathVariable Long importJobId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Lấy chi tiết import đánh giá thành công",
                importHistoryService.get(importJobId)
        ));
    }

    @GetMapping("/{importJobId}/error-file")
    public ResponseEntity<byte[]> errorFile(@PathVariable Long importJobId) {
        byte[] body = importHistoryService.exportErrorFile(importJobId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("evaluation-import-errors-" + importJobId + ".xlsx")
                        .build()
                        .toString())
                .body(body);
    }
}
