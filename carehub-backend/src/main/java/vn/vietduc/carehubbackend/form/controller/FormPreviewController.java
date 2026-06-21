package vn.vietduc.carehubbackend.form.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormPreviewDetailResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormPreviewSummaryResponse;
import vn.vietduc.carehubbackend.form.entity.enums.FormStatus;
import vn.vietduc.carehubbackend.form.entity.enums.FormSubjectType;
import vn.vietduc.carehubbackend.form.service.FormPreviewService;

@RestController
@RequestMapping("${app.api-prefix}/form-previews")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormPreviewController {
    private final FormPreviewService formPreviewService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<FormPreviewSummaryResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) FormStatus status,
            @RequestParam(required = false) FormSubjectType subjectType,
            @RequestParam(required = false) Long ownerDepartmentId,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get form previews successfully",
                PageResponse.from(formPreviewService.search(
                        keyword,
                        status,
                        subjectType,
                        ownerDepartmentId,
                        pageable
                ))
        ));
    }

    @GetMapping("/{formId}")
    public ResponseEntity<ApiResponse<FormPreviewDetailResponse>> get(
            @PathVariable Long formId,
            @RequestParam(required = false) Long versionId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get form preview successfully",
                formPreviewService.get(formId, versionId)
        ));
    }
}
