package vn.vietduc.carehubbackend.training.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceDownloadUrlResponse;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;
import vn.vietduc.carehubbackend.training.service.TrainingEvidenceService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/training/records/{recordId}/evidences")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class TrainingEvidenceController {
    private final TrainingEvidenceService evidenceService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EvidenceMetadataResponse>>> list(@PathVariable Long recordId) {
        return ResponseEntity.ok(ApiResponse.success(
                "Get training evidence files successfully",
                evidenceService.list(recordId)
        ));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<EvidenceMetadataResponse>> upload(
            @PathVariable Long recordId,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Upload training evidence successfully",
                evidenceService.upload(recordId, file)
        ));
    }

    @DeleteMapping("/{evidenceId}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @PathVariable Long recordId,
            @PathVariable Long evidenceId
    ) {
        evidenceService.delete(recordId, evidenceId);
        return ResponseEntity.ok(ApiResponse.success("Delete training evidence successfully", null));
    }

    @PostMapping("/{evidenceId}/download-url")
    public ResponseEntity<ApiResponse<EvidenceDownloadUrlResponse>> createDownloadUrl(
            @PathVariable Long recordId,
            @PathVariable Long evidenceId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Create evidence download URL successfully",
                evidenceService.createDownloadUrl(recordId, evidenceId)
        ));
    }

    @PostMapping("/{evidenceId}/preview-url")
    public ResponseEntity<ApiResponse<EvidenceDownloadUrlResponse>> createPreviewUrl(
            @PathVariable Long recordId,
            @PathVariable Long evidenceId
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Create evidence preview URL successfully",
                evidenceService.createPreviewUrl(recordId, evidenceId)
        ));
    }
}
