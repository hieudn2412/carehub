package vn.vietduc.carehubbackend.form.importer.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.importer.dto.FormImportBatchResponse;
import vn.vietduc.carehubbackend.form.importer.dto.FormImportRequest;
import vn.vietduc.carehubbackend.form.importer.service.FormImportService;

@RestController
@RequestMapping("${app.api-prefix}/form-import-batches")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class FormImportController {
    private final FormImportService service;

    @PostMapping
    public ResponseEntity<ApiResponse<FormImportBatchResponse>> preview(@Valid @RequestBody FormImportRequest request) {
        return ResponseEntity.accepted().body(ApiResponse.success("Form import preview completed", service.createPreview(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FormImportBatchResponse>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Get form import batch successfully", service.get(id)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<FormImportBatchResponse>>> list(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success("Get form import batches successfully",
                PageResponse.from(service.list(pageable))));
    }

    @PostMapping("/{id}/application")
    public ResponseEntity<ApiResponse<FormImportBatchResponse>> apply(@PathVariable Long id) {
        return ResponseEntity.accepted().body(ApiResponse.success("Form import application completed", service.apply(id)));
    }
}
