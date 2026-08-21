package vn.vietduc.carehubbackend.dashboard.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.dashboard.dto.ManagerDashboardOverviewResponse;
import vn.vietduc.carehubbackend.dashboard.dto.ManagerDashboardEmployeeResponse;
import vn.vietduc.carehubbackend.dashboard.service.DashboardAccessPolicy;
import vn.vietduc.carehubbackend.dashboard.service.ManagerDashboardService;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationPermissions;
import vn.vietduc.carehubbackend.questiongeneration.security.EvaluationSecurity;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/dashboard/manager")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class ManagerDashboardController {
    private final ManagerDashboardService managerDashboardService;
    private final DashboardAccessPolicy dashboardAccessPolicy;
    private final EvaluationSecurity evaluationSecurity;

    @GetMapping("/overview")
    public ResponseEntity<ApiResponse<ManagerDashboardOverviewResponse>> overview(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate toDate,
            @RequestParam(defaultValue = "false") boolean allTime,
            @RequestParam(required = false) Long professionalFieldId,
            Authentication authentication
    ) {
        Long departmentId = dashboardAccessPolicy.resolveDepartmentScope(null);
        boolean includeTheory = evaluationSecurity.hasAny(
                authentication,
                EvaluationPermissions.RESULT_VIEWER,
                EvaluationPermissions.EXAM_PUBLISHER
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get manager dashboard overview successfully",
                managerDashboardService.overview(
                        departmentId,
                        fromDate,
                        toDate,
                        allTime,
                        professionalFieldId,
                        includeTheory
                )
        ));
    }

    @GetMapping("/employee")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<ManagerDashboardEmployeeResponse>> employee(
            @RequestParam String employeeCode
    ) {
        Long departmentId = dashboardAccessPolicy.resolveDepartmentScope(null);
        return ResponseEntity.ok(ApiResponse.success(
                "Resolve manager dashboard employee successfully",
                managerDashboardService.findEmployee(departmentId, employeeCode)
        ));
    }
}
