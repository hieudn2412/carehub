package vn.vietduc.carehubbackend.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordSubmitRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordDetailResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingRecordOptionsResponse;
import vn.vietduc.carehubbackend.training.service.TrainingRecordService;

@RestController
@RequestMapping("${app.api-prefix}/training/records")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TrainingRecordController {
    private final TrainingRecordService recordService;

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
}
