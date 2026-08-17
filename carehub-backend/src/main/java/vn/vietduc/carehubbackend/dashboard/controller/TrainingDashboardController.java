package vn.vietduc.carehubbackend.dashboard.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.dashboard.service.DashboardAccessPolicy;
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDashboardSummaryResponse;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/dashboard/training")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class TrainingDashboardController {
    private final TrainingStatusService trainingStatusService;
    private final DashboardAccessPolicy dashboardAccessPolicy;

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<TrainingDashboardSummaryResponse>> summary(
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) ComplianceStatus complianceStatus,
            @RequestParam(required = false) Boolean compliant,
            @RequestParam(required = false) LocalDate asOf
    ) {
        Long scopedDepartmentId = dashboardAccessPolicy.resolveDepartmentScope(departmentId);
        EmployeeTrainingStatusSearchRequest request = new EmployeeTrainingStatusSearchRequest(
                null,
                employeeId,
                scopedDepartmentId,
                null,
                professionalFieldId,
                complianceStatus,
                null,
                null,
                null,
                compliant,
                asOf
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get training dashboard summary successfully",
                trainingStatusService.getDashboardSummary(request)
        ));
    }
}
