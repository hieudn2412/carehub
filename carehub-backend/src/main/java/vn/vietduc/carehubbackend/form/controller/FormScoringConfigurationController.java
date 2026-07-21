package vn.vietduc.carehubbackend.form.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.*;
import vn.vietduc.carehubbackend.form.dto.request.UpdateFormScoringConfigurationRequest;
import vn.vietduc.carehubbackend.form.dto.response.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.scoring.*;

@RestController
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormScoringConfigurationController {
    private final FormScoringConfigurationService configurationService;
    private final FormScoringRecalculationJobService jobService;

    @GetMapping("${app.api-prefix}/form-scoring-configurations")
    public ResponseEntity<ApiResponse<PageResponse<FormScoringConfigurationResponse>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) FormVersionStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success("Get form scoring configurations successfully",
                PageResponse.from(configurationService.search(keyword, status, pageable))));
    }

    @PatchMapping("${app.api-prefix}/forms/{formId}/versions/{versionId}/scoring-configuration")
    public ResponseEntity<ApiResponse<UpdateFormScoringConfigurationResponse>> update(
            @PathVariable Long formId,
            @PathVariable Long versionId,
            @Valid @RequestBody UpdateFormScoringConfigurationRequest request) {
        UpdateFormScoringConfigurationResponse response = configurationService.update(formId, versionId, request);
        HttpStatus status = response.recalculationScheduled() ? HttpStatus.ACCEPTED : HttpStatus.OK;
        return ResponseEntity.status(status).body(ApiResponse.success(
                response.recalculationScheduled()
                        ? "Scoring recalculation scheduled successfully"
                        : "Update form scoring configuration successfully",
                response));
    }

    @GetMapping("${app.api-prefix}/form-scoring-recalculation-jobs/{jobId}")
    public ResponseEntity<ApiResponse<FormScoringRecalculationJobResponse>> getJob(@PathVariable Long jobId) {
        return ResponseEntity.ok(ApiResponse.success("Get scoring recalculation job successfully",
                jobService.get(jobId)));
    }

    @PostMapping("${app.api-prefix}/form-scoring-recalculation-jobs/{jobId}/retry")
    public ResponseEntity<ApiResponse<FormScoringRecalculationJobResponse>> retryJob(@PathVariable Long jobId) {
        return ResponseEntity.accepted().body(ApiResponse.success("Scoring recalculation job queued again",
                jobService.retry(jobId)));
    }
}
