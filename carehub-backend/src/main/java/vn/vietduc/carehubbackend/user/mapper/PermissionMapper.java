package vn.vietduc.carehubbackend.user.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.user.dto.response.PermissionResponse;
import vn.vietduc.carehubbackend.user.entity.Permission;

import java.util.List;

@Component
public class PermissionMapper {

    public PermissionResponse toResponse(Permission permission) {
        return PermissionResponse.builder()
                .id(permission.getId())
                .code(permission.getCode())
                .name(permission.getName())
                .createdAt(permission.getCreatedAt())
                .updatedAt(permission.getUpdatedAt())
                .build();
    }

    public List<PermissionResponse> toResponseList(List<Permission> permissions) {
        return permissions.stream().map(this::toResponse).toList();
    }
}
