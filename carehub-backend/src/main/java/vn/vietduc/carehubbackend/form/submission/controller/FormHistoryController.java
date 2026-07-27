package vn.vietduc.carehubbackend.form.submission.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormVersionHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.service.FormHistoryService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/forms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormHistoryController {
    private final FormHistoryService historyService;

    @GetMapping("/history")
    public ApiResponse<PageResponse<FormHistorySummaryResponse>> searchHistoryForms(
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 12) Pageable pageable
    ) {
        return ApiResponse.success(
                "Get form history successfully",
                PageResponse.from(historyService.searchForms(keyword, pageable))
        );
    }

    @GetMapping("/{formId}/history")
    public ApiResponse<FormResponse> getHistoryForm(@PathVariable Long formId) {
        return ApiResponse.success("Get history form successfully", historyService.getForm(formId));
    }

    @GetMapping("/{formId}/history/versions")
    public ApiResponse<List<FormVersionHistorySummaryResponse>> getHistoryVersions(@PathVariable Long formId) {
        return ApiResponse.success(
                "Get form history versions successfully",
                historyService.getVersions(formId)
        );
    }
}
