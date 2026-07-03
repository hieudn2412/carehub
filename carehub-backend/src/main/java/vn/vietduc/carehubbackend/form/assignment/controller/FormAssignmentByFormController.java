package vn.vietduc.carehubbackend.form.assignment.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.assignment.dto.FormManagerAssignmentResponse;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentStatus;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentService;

@RestController
@RequestMapping("${app.api-prefix}/forms/{formId}/assignments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class FormAssignmentByFormController {
    private final FormAssignmentService service;

    @GetMapping
    public ApiResponse<PageResponse<FormManagerAssignmentResponse>> list(
            @PathVariable Long formId,
            @RequestParam(defaultValue = "ACTIVE") FormAssignmentStatus status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.success("Get form manager assignments successfully",
                PageResponse.from(service.searchByForm(formId, status, pageable)));
    }
}
