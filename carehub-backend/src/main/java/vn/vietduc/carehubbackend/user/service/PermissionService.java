package vn.vietduc.carehubbackend.user.service;

import vn.vietduc.carehubbackend.user.dto.request.CreateUpdatePermissionRequest;
import vn.vietduc.carehubbackend.user.dto.response.PermissionResponse;
import vn.vietduc.carehubbackend.user.entity.Permission;

import java.util.List;

public interface PermissionService {
    PermissionResponse getPermissionById(Long permissionId);
    List<PermissionResponse> getAllPermissions();
    List<PermissionResponse> getAllPermissionsByRoleId(Long roleId);
    PermissionResponse getPermissionByName(String permissionName);
    PermissionResponse createPermission(CreateUpdatePermissionRequest request);
    List<PermissionResponse> createPermissions(List<CreateUpdatePermissionRequest> request);
    PermissionResponse updatePermission(Long id, CreateUpdatePermissionRequest request);
}
