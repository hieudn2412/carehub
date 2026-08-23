package vn.vietduc.carehubbackend.form.assignment.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.form.assignment.dto.FormAssignmentDepartmentScopeResponse;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}/form-assignments")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class FormAssignmentScopeController {
    private final FormAssignmentService service;

    @GetMapping("/allowed-departments")
    public ApiResponse<List<FormAssignmentDepartmentScopeResponse>> allowedDepartments(
            @RequestParam Long formId) {
        return ApiResponse.success("Get assignment department scope successfully",
                service.allowedDepartmentsForForm(formId));
    }
}
