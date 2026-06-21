package vn.vietduc.carehubbackend.training.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.training.dto.response.PersonalTrainingStatusResponse;
import vn.vietduc.carehubbackend.training.service.TrainingStatusService;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/training")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TrainingStatusController {
    private final TrainingStatusService statusService;

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
}
