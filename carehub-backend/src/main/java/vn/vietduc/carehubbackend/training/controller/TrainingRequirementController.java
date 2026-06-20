package vn.vietduc.carehubbackend.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
import vn.vietduc.carehubbackend.training.dto.request.RequirementFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.RequirementSearchRequest;
import vn.vietduc.carehubbackend.training.dto.request.RequirementStatusRequest;
import vn.vietduc.carehubbackend.training.dto.response.RequirementDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.RequirementListResponse;
import vn.vietduc.carehubbackend.training.service.TrainingRequirementService;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/training/requirements")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class TrainingRequirementController {
    private final TrainingRequirementService requirementService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<RequirementListResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) Long jobPositionId,
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) LocalDate effectiveOn,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        RequirementSearchRequest request = new RequirementSearchRequest(
                keyword,
                active,
                departmentId,
                jobPositionId,
                professionalFieldId,
                effectiveOn
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get training requirements successfully",
                PageResponse.from(requirementService.search(request, pageable))
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RequirementDetailResponse>> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training requirement successfully",
                requirementService.getDetail(id)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RequirementDetailResponse>> create(
            @Valid @RequestBody RequirementFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Create training requirement successfully",
                requirementService.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RequirementDetailResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody RequirementFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update training requirement successfully",
                requirementService.update(id, request)
        ));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<RequirementDetailResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody RequirementStatusRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update training requirement status successfully",
                requirementService.updateStatus(id, request)
        ));
    }
}
