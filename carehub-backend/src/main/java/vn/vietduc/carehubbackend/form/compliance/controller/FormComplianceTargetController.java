package vn.vietduc.carehubbackend.form.compliance.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.form.compliance.dto.ComplianceTargetRequest;
import vn.vietduc.carehubbackend.form.compliance.dto.ComplianceTargetResponse;
import vn.vietduc.carehubbackend.form.compliance.service.FormComplianceTargetService;

@RestController
@RequestMapping("${app.api-prefix}/quality/compliance-targets/forms/{formId}")
@RequiredArgsConstructor
public class FormComplianceTargetController {
    private final FormComplianceTargetService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ComplianceTargetResponse>> get(@PathVariable Long formId) {
        return ResponseEntity.ok(ApiResponse.success("Lấy cấu hình mục tiêu thành công", service.get(formId)));
    }

    @PutMapping("/hospital")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ComplianceTargetResponse>> putHospital(
            @PathVariable Long formId, @Valid @RequestBody ComplianceTargetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật mục tiêu bệnh viện thành công",
                service.putHospital(formId, request)));
    }

    @PutMapping("/departments/{departmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ComplianceTargetResponse>> putDepartment(
            @PathVariable Long formId, @PathVariable Long departmentId,
            @Valid @RequestBody ComplianceTargetRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật mục tiêu khoa thành công",
                service.putDepartment(formId, departmentId, request)));
    }

    @DeleteMapping("/departments/{departmentId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ApiResponse<ComplianceTargetResponse>> deleteDepartment(
            @PathVariable Long formId, @PathVariable Long departmentId,
            @RequestParam(required = false) Long lockVersion) {
        return ResponseEntity.ok(ApiResponse.success("Đã chuyển về mục tiêu kế thừa",
                service.deleteDepartment(formId, departmentId, lockVersion)));
    }
}
