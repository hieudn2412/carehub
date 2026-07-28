package vn.vietduc.carehubbackend.form.subject.controller;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.common.response.PageResponse;
import vn.vietduc.carehubbackend.form.subject.dto.FormSubjectUserResponse;
import vn.vietduc.carehubbackend.form.subject.service.FormSubjectService;

@RestController
@RequestMapping("${app.api-prefix}/form-subjects")
@RequiredArgsConstructor
@Validated
public class FormSubjectController {
    private final FormSubjectService service;

    @GetMapping("/users")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<FormSubjectUserResponse>> findUser(
            @RequestParam(required = false) Long assignmentItemId,
            @RequestParam @NotBlank @Size(max = 100) String employeeCode) {
        return ResponseEntity.ok(ApiResponse.success("Get form subject successfully",
                service.findByEmployeeCode(assignmentItemId, employeeCode)));
    }

    @GetMapping("/users/search")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<PageResponse<FormSubjectUserResponse>>> searchUsers(
            @RequestParam(required = false) Long assignmentItemId,
            @RequestParam(required = false) @Size(max = 100) String keyword,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success("Search form subjects successfully",
                PageResponse.from(service.search(assignmentItemId, keyword, pageable))));
    }
}
