package vn.vietduc.carehubbackend.imports.user.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.imports.user.dto.ImportLogResponse;
import vn.vietduc.carehubbackend.imports.user.entity.ImportLog;
import vn.vietduc.carehubbackend.imports.user.repository.ImportLogRepository;

@RestController
@RequestMapping("${app.api-prefix}/system/import-logs")
@RequiredArgsConstructor
public class ImportLogController {
    private final ImportLogRepository importLogRepository;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Page<ImportLogResponse>>> getImportLogs(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable
    ) {
        Page<ImportLog> logs;
        boolean hasQ = q != null && !q.isBlank();
        boolean hasStatus = status != null && !status.isBlank();

        if (hasQ && hasStatus) {
            logs = importLogRepository.findBySourceFileContainingIgnoreCaseAndStatus(q, status, pageable);
        } else if (hasQ) {
            logs = importLogRepository.findBySourceFileContainingIgnoreCase(q, pageable);
        } else if (hasStatus) {
            logs = importLogRepository.findByStatus(status, pageable);
        } else {
            logs = importLogRepository.findAll(pageable);
        }

        return ResponseEntity.ok(ApiResponse.success(
                "Get import logs successfully",
                logs.map(ImportLogResponse::from)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ImportLogResponse>> getImportLog(@PathVariable Long id) {
        ImportLog log = importLogRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Import log not found"));

        return ResponseEntity.ok(ApiResponse.success(
                "Get import log successfully",
                ImportLogResponse.from(log)));
    }
}
