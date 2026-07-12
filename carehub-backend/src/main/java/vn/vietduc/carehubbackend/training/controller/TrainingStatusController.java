package vn.vietduc.carehubbackend.training.controller;

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
import vn.vietduc.carehubbackend.training.dto.request.EmployeeTrainingStatusSearchRequest;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingRecordLedgerResponse;
import vn.vietduc.carehubbackend.training.dto.response.EmployeeTrainingStatusSummaryResponse;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.enums.ComplianceStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;

import java.math.BigDecimal;
import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/training")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TrainingStatusController {
    private final TrainingStatusService statusService;

    @GetMapping("/employees/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SYSTEM_JOB')")
    public ResponseEntity<ApiResponse<PageResponse<EmployeeTrainingStatusSummaryResponse>>> listEmployeeStatuses(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long jobPositionId,
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) ComplianceStatus complianceStatus,
            @RequestParam(required = false) BigDecimal submittedHoursMin,
            @RequestParam(required = false) BigDecimal submittedHoursMax,
            @RequestParam(required = false) Boolean requirementConfigured,
            @RequestParam(required = false) LocalDate asOf,
            @PageableDefault(size = 20, sort = "employeeCode", direction = Sort.Direction.ASC)
            Pageable pageable
    ) {
        EmployeeTrainingStatusSearchRequest request = new EmployeeTrainingStatusSearchRequest(
                keyword,
                departmentId,
                jobPositionId,
                professionalFieldId,
                complianceStatus,
                submittedHoursMin,
                submittedHoursMax,
                requirementConfigured,
                asOf
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get employee training statuses successfully",
                PageResponse.from(statusService.getEmployeeStatuses(request, pageable))
        ));
    }

    @GetMapping("/status/me")
    public ResponseEntity<ApiResponse<PersonalTrainingStatusResponse>> getMyStatus(
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) LocalDate asOf
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training status successfully",
                statusService.getMyStatus(professionalFieldId, asOf)
        ));
    }

    @GetMapping("/employees/{employeeId}/status")
    public ResponseEntity<ApiResponse<PersonalTrainingStatusResponse>> getEmployeeStatus(
            @PathVariable Long employeeId,
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) LocalDate asOf
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get employee training status successfully",
                statusService.getEmployeeStatus(employeeId, professionalFieldId, asOf)
        ));
    }

    @GetMapping("/employees/{employeeId}/records")
    public ResponseEntity<ApiResponse<PageResponse<EmployeeTrainingRecordLedgerResponse>>> getEmployeeRecords(
            @PathVariable Long employeeId,
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) LocalDate asOf,
            @RequestParam(required = false) TrainingRecordStatus workflowStatus,
            @PageableDefault(size = 20, sort = "startDate", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get employee training records successfully",
                PageResponse.from(statusService.getEmployeeRecords(
                        employeeId,
                        professionalFieldId,
                        asOf,
                        workflowStatus,
                        pageable
                ))
        ));
    }
}
