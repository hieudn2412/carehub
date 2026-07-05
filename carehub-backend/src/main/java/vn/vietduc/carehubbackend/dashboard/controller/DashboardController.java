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
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormPerformanceResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormSummaryResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardFormTrendResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardOverviewResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardRecentActivityResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardTrendBucket;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardUserSummaryResponse;
import vn.vietduc.carehubbackend.dashboard.dto.DashboardUsersByDepartmentResponse;
import vn.vietduc.carehubbackend.dashboard.service.DashboardService;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DashboardController {
    private final DashboardService dashboardService;

    @GetMapping("/overview")
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
    public ResponseEntity<ApiResponse<DashboardUserSummaryResponse>> userSummary(
            @RequestParam(required = false) Long departmentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard user summary successfully",
                dashboardService.userSummary(departmentId)
        ));
    }

    @GetMapping("/users/by-department")
    public ResponseEntity<ApiResponse<DashboardUsersByDepartmentResponse>> usersByDepartment(
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard users by department successfully",
                dashboardService.usersByDepartment(limit)
        ));
    }

    @GetMapping("/forms/summary")
    public ResponseEntity<ApiResponse<DashboardFormSummaryResponse>> formSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) Long departmentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form summary successfully",
                dashboardService.formSummary(fromDate, toDate, departmentId)
        ));
    }

    @GetMapping("/forms/performance")
    public ResponseEntity<ApiResponse<PageResponse<DashboardFormPerformanceResponse>>> formPerformance(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) Long departmentId,
            @PageableDefault(size = 10, sort = "responseCount", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form performance successfully",
                PageResponse.from(dashboardService.formPerformance(fromDate, toDate, departmentId, pageable))
        ));
    }

    @GetMapping("/forms/trend")
    public ResponseEntity<ApiResponse<DashboardFormTrendResponse>> formTrend(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(required = false) DashboardTrendBucket bucket,
            @RequestParam(required = false) Long departmentId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get dashboard form trend successfully",
                dashboardService.formTrend(fromDate, toDate, bucket, departmentId)
        ));
    }

    @GetMapping("/recent-activity")
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
