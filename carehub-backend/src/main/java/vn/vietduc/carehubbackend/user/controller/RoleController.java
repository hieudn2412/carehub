package vn.vietduc.carehubbackend.user.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.vietduc.carehubbackend.common.response.ApiResponse;
import vn.vietduc.carehubbackend.user.dto.request.CreateRoleRequest;
import vn.vietduc.carehubbackend.user.dto.response.RoleResponse;
import vn.vietduc.carehubbackend.user.service.RoleService;

import java.util.List;

@RestController
@RequestMapping("${app.api-prefix}")
@RequiredArgsConstructor
public class RoleController {
    private final RoleService roleService;

    @GetMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> getRoles() {
        List<RoleResponse> roles = roleService.getAllRoles();
        return ResponseEntity.ok(ApiResponse.success("success", roles));
    }

    @PostMapping("/roles")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<RoleResponse>>> addRole(@Valid @RequestBody List<CreateRoleRequest> requests) {
        List<RoleResponse> roles = roleService.createRoles(requests);
        return ResponseEntity.ok(ApiResponse.success("success", roles));
    }

    @DeleteMapping("/roles/{roleId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable Long roleId) {
        roleService.deleteRoleById(roleId);
        return ResponseEntity.ok(ApiResponse.success("Role deleted successfully", null));
    }
}
