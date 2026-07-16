package vn.vietduc.carehubbackend.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSearchRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSubmitRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordListResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordOptionsResponse;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingSourceType;
import vn.vietduc.carehubbackend.training.service.TrainingRecordService;

import java.time.LocalDate;

@RestController
@RequestMapping("${app.api-prefix}/training/records")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TrainingRecordController {
    private final TrainingRecordService recordService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<TrainingRecordListResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(required = false) Long activityTypeId,
            @RequestParam(required = false) Long professionalFieldId,
            @RequestParam(required = false) TrainingRecordStatus workflowStatus,
            @RequestParam(required = false) Boolean hasEvidence,
            @RequestParam(required = false) EvidenceModerationStatus moderationStatus,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) TrainingSourceType sourceType,
            @PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        TrainingRecordSearchRequest request = new TrainingRecordSearchRequest(
                keyword,
                dateFrom,
                dateTo,
                activityTypeId,
                professionalFieldId,
                workflowStatus,
                hasEvidence,
                moderationStatus,
                employeeId,
                departmentId,
                sourceType
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Get training records successfully",
                PageResponse.from(recordService.search(request, pageable))
        ));
    }

    @GetMapping("/options")
    public ResponseEntity<ApiResponse<TrainingRecordOptionsResponse>> getOptions() {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training record options successfully",
                recordService.getOptions()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TrainingRecordDetailResponse>> getDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training record successfully",
                recordService.getDetail(id)
        ));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TrainingRecordDetailResponse>> create(
            @Valid @RequestBody TrainingRecordFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Create training record successfully",
                recordService.create(request)
        ));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TrainingRecordDetailResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody TrainingRecordFormRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Update training record successfully",
                recordService.update(id, request)
        ));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<ApiResponse<TrainingRecordDetailResponse>> submit(
            @PathVariable Long id,
            @RequestBody(required = false) TrainingRecordSubmitRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Submit training record successfully",
                recordService.submit(id, request)
        ));
    }

    @PostMapping("/{id}/return-to-draft")
    public ResponseEntity<ApiResponse<TrainingRecordDetailResponse>> returnToDraft(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Trả hồ sơ về nháp thành công",
                recordService.returnToDraft(id)
        ));
    }
}
