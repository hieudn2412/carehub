package vn.vietduc.carehubbackend.form.assignment.controller;

import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.form.assignment.dto.BulkFormAssignmentItemIdsRequest;
import vn.vietduc.carehubbackend.form.assignment.dto.BulkFormAssignmentValidityRequest;
import vn.vietduc.carehubbackend.form.assignment.dto.UpdateFormAssignmentDepartmentScopeRequest;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentService;

import vn.vietduc.carehubbackend.form.assignment.dto.FormAssignmentDepartmentScopeResponse;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/form-assignment-items")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormAssignmentItemController {
    private final FormAssignmentService service;

    @GetMapping("/{id}/allowed-departments")
    public ApiResponse<List<FormAssignmentDepartmentScopeResponse>> allowedDepartmentsForItem(@PathVariable Long id) {
        return ApiResponse.success("Get allowed departments successfully", service.allowedDepartmentsForItem(id));
    }

    @PutMapping("/{id}/allowed-departments")
    public ApiResponse<List<FormAssignmentDepartmentScopeResponse>> updateAllowedDepartmentsForItem(
            @PathVariable Long id,
            @Valid @RequestBody UpdateFormAssignmentDepartmentScopeRequest request
    ) {
        return ApiResponse.success("Update allowed departments successfully",
                service.updateAllowedDepartmentsForItem(id, request));
    }

    @PatchMapping("/bulk-validity")
    public ApiResponse<Integer> bulkValidity(@Valid @RequestBody BulkFormAssignmentValidityRequest request) {
        return ApiResponse.success("Update form assignment validity successfully", service.updateItemValidity(request));
    }

    @PostMapping("/bulk-revoke")
    public ApiResponse<Integer> bulkRevoke(@Valid @RequestBody BulkFormAssignmentItemIdsRequest request) {
        return ApiResponse.success("Revoke form assignment items successfully", service.revokeItems(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> revoke(@PathVariable Long id) {
        service.revokeItem(id);
        return ResponseEntity.noContent().build();
    }
}
