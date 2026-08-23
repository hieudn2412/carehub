package vn.vietduc.carehubbackend.form.submission.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormSubmissionResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormSubmissionSummaryResponse;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.form.submission.service.FormSubmissionService;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/forms")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'STAFF', 'USER')")
public class FormResponseController {
    private final FormSubmissionService service;

    @GetMapping("/{formId}/responses")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<FormSubmissionResponse>> listByForm(
            @PathVariable Long formId,
            @RequestParam(required = false) FormSubmissionStatus status,
            @RequestParam(defaultValue = "false") boolean includeAnswers,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form responses successfully",
                PageResponse.from(service.searchByForm(formId, status, includeAnswers, pageable)));
    }

    @GetMapping("/{formId}/versions/{versionId}/responses")
    public ApiResponse<PageResponse<FormSubmissionResponse>> listByFormVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId,
            @RequestParam(required = false) FormSubmissionStatus status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long submittedByUserId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "false") boolean includeAnswers,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form version responses successfully",
                PageResponse.from(service.searchByFormVersion(
                        formId, versionId, status, keyword, submittedByUserId, departmentId,
                        result, dateFrom, dateTo, includeAnswers, pageable)));
    }

    @GetMapping("/{formId}/versions/{versionId}/responses/summary")
    public ApiResponse<FormSubmissionSummaryResponse> summarizeByFormVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long submittedByUserId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo
    ) {
        return ApiResponse.success(
                "Get form version response summary successfully",
                service.summarizeByFormVersion(
                        formId, versionId, keyword, submittedByUserId, departmentId,
                        result, dateFrom, dateTo)
        );
    }

    @GetMapping("/evaluations/history")
    public ApiResponse<PageResponse<FormSubmissionResponse>> listEvaluationsHistory(
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long submittedByUserId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get evaluations history successfully",
                PageResponse.from(service.searchEvaluationsHistory(
                        formId, keyword, submittedByUserId, departmentId,
                        result, dateFrom, dateTo, pageable)));
    }

    @GetMapping("/evaluations/history/summary")
    public ApiResponse<FormSubmissionSummaryResponse> summarizeEvaluationsHistory(
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long submittedByUserId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo
    ) {
        return ApiResponse.success(
                "Get evaluations history summary successfully",
                service.summarizeEvaluationsHistory(
                        formId, keyword, submittedByUserId, departmentId,
                        result, dateFrom, dateTo)
        );
    }
}
