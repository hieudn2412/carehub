package vn.vietduc.carehubbackend.training.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.training.dto.request.TrainingImportApplyRequest;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDurationParseResponse;
import vn.vietduc.carehubbackend.training.dto.response.TrainingImportBatchResponse;
import vn.vietduc.carehubbackend.training.service.TrainingLegacyImportService;

import java.io.IOException;

@RestController
@RequestMapping("${app.api-prefix}/training/imports/legacy")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','MANAGER','SYSTEM_JOB')")
public class TrainingLegacyImportController {
    private final TrainingLegacyImportService importService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<TrainingImportBatchResponse>>> list(
            @PageableDefault(size = 20, sort = "importedAt", direction = Sort.Direction.DESC)
            Pageable pageable
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get legacy training import batches successfully",
                PageResponse.from(importService.list(pageable))
        ));
    }

    @GetMapping("/{batchId}")
    public ResponseEntity<ApiResponse<TrainingImportBatchResponse>> get(@PathVariable Long batchId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get legacy training import batch successfully",
                importService.get(batchId)
        ));
    }

    @PostMapping(value = "/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TrainingImportBatchResponse>> preview(
            @RequestParam MultipartFile file,
            @RequestParam Long activityTypeId,
            @RequestParam(required = false) Long professionalFieldId
    ) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(
                "Preview legacy training import successfully",
                importService.createPreview(file, activityTypeId, professionalFieldId)
        ));
    }

    @PostMapping("/{batchId}/apply")
    public ResponseEntity<ApiResponse<TrainingImportBatchResponse>> apply(
            @PathVariable Long batchId,
            @RequestBody(required = false) TrainingImportApplyRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Apply legacy training import successfully",
                importService.apply(batchId, request)
        ));
    }

    @GetMapping("/duration/parse")
    public ResponseEntity<ApiResponse<TrainingDurationParseResponse>> parseDuration(@RequestParam String rawText) {
        return ResponseEntity.ok(ApiResponse.success(
                "Parse legacy duration successfully",
                importService.parseDuration(rawText)
        ));
    }
}
