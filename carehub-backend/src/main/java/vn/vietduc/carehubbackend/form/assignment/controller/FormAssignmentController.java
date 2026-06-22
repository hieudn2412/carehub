package vn.vietduc.carehubbackend.form.assignment.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import vn.vietduc.carehubbackend.common.response.*;
import vn.vietduc.carehubbackend.form.assignment.dto.*;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentService;

import java.net.URI;

@RestController
@RequestMapping("${app.api-prefix}/form-assignments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormAssignmentController {
    private final FormAssignmentService service;

    @PostMapping
    public ResponseEntity<ApiResponse<FormAssignmentResponse>> create(@Valid @RequestBody CreateFormAssignmentRequest request) {
        FormAssignmentResponse response = service.create(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(response.id()).toUri();
        return ResponseEntity.created(location).body(ApiResponse.success("Create form assignment successfully", response));
    }

    @GetMapping
    public ApiResponse<PageResponse<FormAssignmentResponse>> search(
            @RequestParam(required = false) Long managerId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form assignments successfully", PageResponse.from(service.search(managerId, pageable)));
    }

    @GetMapping("/{id}")
    public ApiResponse<FormAssignmentResponse> get(@PathVariable Long id) {
        return ApiResponse.success("Get form assignment successfully", service.get(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable Long id) {
        service.revoke(id);
        return ResponseEntity.noContent().build();
    }
}
