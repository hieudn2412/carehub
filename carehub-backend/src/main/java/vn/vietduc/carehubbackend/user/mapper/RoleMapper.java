package vn.vietduc.carehubbackend.user.mapper;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.user.dto.response.RoleResponse;
import vn.vietduc.carehubbackend.user.entity.Role;

import java.util.List;

@Component
public class RoleMapper {

    public RoleResponse toResponse(Role role) {
        return RoleResponse.builder()
                .id(role.getId())
                .code(role.getCode())
                .name(role.getName())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .build();
    }

    public List<RoleResponse> toResponseList(List<Role> roles) {
        return roles.stream().map(this::toResponse).toList();
    }
}
