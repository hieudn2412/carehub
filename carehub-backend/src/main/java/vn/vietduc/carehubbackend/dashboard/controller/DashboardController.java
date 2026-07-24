package vn.vietduc.carehubbackend.dashboard.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardActivityType;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormFilter;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormFilterOptionsResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormPerformanceResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormResultFilter;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormSummaryResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormTrendResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardMyFormSummaryResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardOverviewResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardRecentActivityResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardTrendBucket;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardUserSummaryResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardUsersByDepartmentResponse;
import vn.vietduc.carehubbackend.dashboard.service.DashboardAccessPolicy;
import vn.vietduc.carehubbackend.dashboard.service.DashboardService;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final DashboardService dashboardService;
    private final DashboardAccessPolicy dashboardAccessPolicy;
    private final SecurityUtils securityUtils;

    @GetMapping("/overview")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<DashboardOverviewResponse>> overview(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) Long departmentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard overview successfully",
                dashboardService.overview(fromDate, toDate, departmentId)
        ));
    }

    @GetMapping("/users/summary")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<DashboardUserSummaryResponse>> userSummary(
            @RequestParam(required = false) Long departmentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard user summary successfully",
                dashboardService.userSummary(departmentId)
        ));
    }

    @GetMapping("/users/by-department")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<DashboardUsersByDepartmentResponse>> usersByDepartment(
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard users by department successfully",
                dashboardService.usersByDepartment(limit)
        ));
    }

    @GetMapping("/forms/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<DashboardFormSummaryResponse>> formSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) Long departmentId
    ) {
        Long scopedDepartmentId = dashboardAccessPolicy.resolveDepartmentScope(departmentId);
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form summary successfully",
                dashboardService.formSummary(fromDate, toDate, scopedDepartmentId)
        ));
    }

    @GetMapping("/forms/performance")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<PageResponse<DashboardFormPerformanceResponse>>> formPerformance(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) Long subjectUserId,
            @RequestParam(required = false) Long submittedByUserId,
            @RequestParam(required = false) DashboardFormResultFilter resultStatus,
            @PageableDefault(size = 10, sort = "responseCount", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        Long scopedDepartmentId = dashboardAccessPolicy.resolveDepartmentScope(departmentId);
        DashboardFormFilter filter = new DashboardFormFilter(
                fromDate,
                toDate,
                scopedDepartmentId,
                formId,
                subjectUserId,
                submittedByUserId,
                resultStatus
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form performance successfully",
                PageResponse.from(dashboardService.formPerformance(filter, pageable))
        ));
    }

    @GetMapping("/forms/trend")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<DashboardFormTrendResponse>> formTrend(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) DashboardTrendBucket bucket,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) Long subjectUserId,
            @RequestParam(required = false) Long submittedByUserId,
            @RequestParam(required = false) DashboardFormResultFilter resultStatus
    ) {
        Long scopedDepartmentId = dashboardAccessPolicy.resolveDepartmentScope(departmentId);
        DashboardFormFilter filter = new DashboardFormFilter(
                fromDate,
                toDate,
                scopedDepartmentId,
                formId,
                subjectUserId,
                submittedByUserId,
                resultStatus
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form trend successfully",
                dashboardService.formTrend(filter, bucket)
        ));
    }

    @GetMapping("/forms/filter-options")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<DashboardFormFilterOptionsResponse>> formFilterOptions(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) Long departmentId
    ) {
        Long scopedDepartmentId = dashboardAccessPolicy.resolveDepartmentScope(departmentId);
        DashboardFormFilter filter = new DashboardFormFilter(
                fromDate,
                toDate,
                scopedDepartmentId,
                null,
                null,
                null,
                null
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form filter options successfully",
                dashboardService.formFilterOptions(filter)
        ));
    }

    @GetMapping("/me/forms/summary")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DashboardMyFormSummaryResponse>> myFormSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get personal dashboard form summary successfully",
                dashboardService.myFormSummary(fromDate, toDate, securityUtils.getCurrentUserId())
        ));
    }

    @GetMapping("/recent-activity")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<DashboardRecentActivityResponse>> recentActivity(
            @RequestParam(required = false) DashboardActivityType type,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard recent activity successfully",
                dashboardService.recentActivity(type, limit)
        ));
    }
}
