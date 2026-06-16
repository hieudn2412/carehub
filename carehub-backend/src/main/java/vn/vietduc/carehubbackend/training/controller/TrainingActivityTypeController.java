package vn.vietduc.carehubbackend.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.ActivityTypeStatusRequest;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.ActivityTypeListResponse;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.service.TrainingActivityTypeService;

@RestController
@RequestMapping("${app.api-prefix}/training/activity-types")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class TrainingActivityTypeController {
    private final TrainingActivityTypeService activityTypeService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<ActivityTypeListResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(name = "isActive", required = false) Boolean active,
            @RequestParam(required = false) Boolean requiresEvidence,
            @RequestParam(required = false) DurationUnit durationUnit,
            @PageableDefault(size = 20)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training activity types successfully",
                PageResponse.from(activityTypeService.search(keyword, active, requiresEvidence, durationUnit, pageable))
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ActivityTypeDetailResponse>> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training activity type successfully",
                activityTypeService.getDetail(id)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ActivityTypeDetailResponse>> create(
            @Valid @RequestBody ActivityTypeFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Create training activity type successfully",
                activityTypeService.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ActivityTypeDetailResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody ActivityTypeFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update training activity type successfully",
                activityTypeService.update(id, request)
        ));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<ActivityTypeDetailResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody ActivityTypeStatusRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update training activity type status successfully",
                activityTypeService.updateStatus(id, request)
        ));
    }
}
