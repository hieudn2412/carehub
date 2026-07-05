package vn.vietduc.carehubbackend.form.submission.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormSubmissionResponse;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.form.submission.service.FormSubmissionService;

@RestController
@RequestMapping("${app.api-prefix}/forms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormResponseController {
    private final FormSubmissionService service;

    @GetMapping("/{formId}/responses")
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
            @RequestParam(defaultValue = "false") boolean includeAnswers,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form version responses successfully",
                PageResponse.from(service.searchByFormVersion(formId, versionId, status, includeAnswers, pageable)));
    }
}
