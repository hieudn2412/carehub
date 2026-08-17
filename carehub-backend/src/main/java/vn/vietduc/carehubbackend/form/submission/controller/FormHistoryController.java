package vn.vietduc.carehubbackend.form.submission.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormResponse;
import vn.vietduc.carehubbackend.form.dto.response.FormVersionResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormHistoryTotalsResponse;
import vn.vietduc.carehubbackend.form.submission.dto.FormVersionHistorySummaryResponse;
import vn.vietduc.carehubbackend.form.submission.service.FormHistoryService;

import java.util.List;
import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/forms")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class FormHistoryController {
    private final FormHistoryService historyService;

    @GetMapping("/history")
    public ApiResponse<PageResponse<FormHistorySummaryResponse>> searchHistoryForms(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @PageableDefault(size = 12) Pageable pageable
    ) {
        return ApiResponse.success(
                "Get form history successfully",
                PageResponse.from(historyService.searchForms(keyword, dateFrom, dateTo, pageable))
        );
    }

    @GetMapping("/history/summary")
    public ApiResponse<FormHistoryTotalsResponse> getHistorySummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) Long subjectUserId
    ) {
        return ApiResponse.success(
                "Get form history summary successfully",
                historyService.getSummary(dateFrom, dateTo, subjectUserId)
        );
    }

    @GetMapping("/{formId}/history")
    public ApiResponse<FormResponse> getHistoryForm(@PathVariable Long formId) {
        return ApiResponse.success("Get history form successfully", historyService.getForm(formId));
    }

    @GetMapping("/{formId}/history/versions")
    public ApiResponse<List<FormVersionHistorySummaryResponse>> getHistoryVersions(
            @PathVariable Long formId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {
        return ApiResponse.success(
                "Get form history versions successfully",
                historyService.getVersions(formId, dateFrom, dateTo)
        );
    }

    @GetMapping("/{formId}/history/versions/{versionId}")
    public ApiResponse<FormVersionResponse> getHistoryVersion(
            @PathVariable Long formId,
            @PathVariable Long versionId) {
        return ApiResponse.success(
                "Get form history version successfully",
                historyService.getVersion(formId, versionId)
        );
    }
}
