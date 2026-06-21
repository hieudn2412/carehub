package vn.vietduc.carehubbackend.form.submission.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import vn.vietduc.carehubbackend.common.response.*;
import vn.vietduc.carehubbackend.form.submission.dto.*;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.form.submission.service.FormSubmissionService;

import java.net.URI;

@RestController
@RequestMapping("${app.api-prefix}/form-submissions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
public class FormSubmissionController {
    private final FormSubmissionService service;

    @PostMapping
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<ApiResponse<FormSubmissionResponse>> create(
            @Valid @RequestBody CreateFormSubmissionRequest request) {
        FormSubmissionResponse response = service.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(response.id()).toUri();
        return ResponseEntity.created(location).body(ApiResponse.success("Create form submission draft successfully", response));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<FormSubmissionResponse> update(@PathVariable Long id,
                                                       @Valid @RequestBody UpdateFormSubmissionRequest request) {
        return ApiResponse.success("Update form submission successfully", service.update(id, request));
    }

    @PostMapping("/{id}/submission")
    @PreAuthorize("hasRole('MANAGER')")
    public ApiResponse<FormSubmissionResponse> submit(@PathVariable Long id,
                                                       @Valid @RequestBody SubmitFormSubmissionRequest request) {
        return ApiResponse.success("Submit form successfully", service.submit(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGER')")
    public ResponseEntity<Void> cancel(@PathVariable Long id) {
        service.cancel(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ApiResponse<PageResponse<FormSubmissionResponse>> search(
            @RequestParam(required = false) FormSubmissionStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form submissions successfully", PageResponse.from(service.search(status, pageable)));
    }

    @GetMapping("/{id}")
    public ApiResponse<FormSubmissionResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Get form submission successfully", service.get(id));
    }
}
