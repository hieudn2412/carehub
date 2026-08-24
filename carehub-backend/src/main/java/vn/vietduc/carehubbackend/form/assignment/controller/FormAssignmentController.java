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
import java.util.List;

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

    @GetMapping("/overview")
    public ApiResponse<FormAssignmentOverviewResponse> overview() {
        return ApiResponse.success("Get form assignment overview successfully", service.overview());
    }

    @GetMapping("/forms")
    public ApiResponse<PageResponse<FormAssignmentFormRowResponse>> assignedForms(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long ownerDepartmentId,
            @RequestParam(defaultValue = "false") boolean expiringSoon,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get assigned forms successfully",
                PageResponse.from(service.assignedFormsDashboard(keyword, ownerDepartmentId, expiringSoon, pageable)));
    }

    @GetMapping("/assignees")
    public ApiResponse<PageResponse<FormAssignmentAssigneeRowResponse>> assignedAssignees(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String roleCode,
            @RequestParam(defaultValue = "false") boolean expiringSoon,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get assigned assignees successfully",
                PageResponse.from(service.assignedAssigneesDashboard(keyword, departmentId, roleCode, expiringSoon, pageable)));
    }

    @GetMapping("/items")
    public ApiResponse<PageResponse<FormAssignmentItemRowResponse>> activeItems(
            @RequestParam(required = false) Long formId,
            @RequestParam(required = false) Long assigneeId,
            @PageableDefault(size = 50) Pageable pageable) {
        return ApiResponse.success("Get form assignment items successfully",
                PageResponse.from(service.activeItems(formId, assigneeId, pageable)));
    }

    @GetMapping("/form-candidates")
    public ApiResponse<PageResponse<FormAssignmentCandidateResponse>> formCandidates(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long ownerDepartmentId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form assignment candidates successfully",
                PageResponse.from(service.formCandidates(keyword, ownerDepartmentId, pageable)));
    }

    @GetMapping("/assignee-candidates")
    public ApiResponse<PageResponse<FormAssignmentCandidateResponse>> assigneeCandidates(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(required = false) String roleCode,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get assignee candidates successfully",
                PageResponse.from(service.assigneeCandidates(keyword, departmentId, roleCode, pageable)));
    }

    @GetMapping("/manager-candidate-ids")
    public ApiResponse<List<FormAssignmentCandidateResponse>> managerCandidates() {
        return ApiResponse.success("Get manager candidates successfully", service.managerCandidates());
    }

    @PostMapping("/preview")
    public ApiResponse<BulkFormAssignmentPreviewResponse> preview(@Valid @RequestBody BulkFormAssignmentRequest request) {
        return ApiResponse.success("Preview form assignments successfully", service.previewBulk(request));
    }

    @PostMapping("/bulk")
    public ApiResponse<BulkFormAssignmentResponse> bulk(@Valid @RequestBody BulkFormAssignmentRequest request) {
        return ApiResponse.success("Bulk assign forms successfully", service.bulkAssign(request));
    }

}
