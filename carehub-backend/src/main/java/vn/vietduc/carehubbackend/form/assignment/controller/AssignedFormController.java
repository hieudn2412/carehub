package vn.vietduc.carehubbackend.form.assignment.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.*;
import vn.vietduc.carehubbackend.form.assignment.dto.AssignedFormResponse;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentService;

@RestController
@RequestMapping("${app.api-prefix}/assigned-forms")
@RequiredArgsConstructor
@PreAuthorize("hasRole('MANAGER')")
public class AssignedFormController {
    private final FormAssignmentService service;

    @GetMapping
    public ApiResponse<PageResponse<AssignedFormResponse>> list(@PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get assigned forms successfully", PageResponse.from(service.assignedForms(pageable)));
    }

    @GetMapping("/{assignmentItemId}")
    public ApiResponse<AssignedFormResponse> get(@PathVariable Long assignmentItemId) {
        return ApiResponse.success("Get assigned form successfully", service.assignedForm(assignmentItemId));
    }
}
