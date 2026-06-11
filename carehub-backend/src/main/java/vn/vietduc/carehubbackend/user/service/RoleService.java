package vn.vietduc.carehubbackend.user.service;

import vn.vietduc.carehubbackend.user.dto.request.CreateRoleRequest;
import vn.vietduc.carehubbackend.user.dto.response.RoleResponse;
import vn.vietduc.carehubbackend.user.entity.Role;

import java.util.List;
import java.util.Optional;

public interface RoleService {
    Optional<Role> findById(Long roleId);
    List<RoleResponse> createRoles(List<CreateRoleRequest> createRoleRequest);
    List<RoleResponse> getAllRoles();
    void deleteRoleById(Long roleId);
}
