package vn.vietduc.carehubbackend.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.user.dto.request.CreateUpdatePermissionRequest;
import vn.vietduc.carehubbackend.user.dto.response.PermissionResponse;
import vn.vietduc.carehubbackend.user.service.PermissionService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
public class PermissionController {
    private final PermissionService permissionService;

    @GetMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> getPermissionsByRoleId(@PathVariable Long roleId) {
        List<PermissionResponse> permissions = permissionService.getAllPermissionsByRoleId(roleId);
        return ResponseEntity.ok(ApiResponse.success("permissions", permissions));
    }

    @PostMapping("/permissions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<PermissionResponse>>> createPermissions(
            @Valid @RequestBody List<CreateUpdatePermissionRequest> request) {
        List<PermissionResponse> permissions = permissionService.createPermissions(request);
        return ResponseEntity.ok(ApiResponse.success("Permissions created successfully", permissions));
    }
}
