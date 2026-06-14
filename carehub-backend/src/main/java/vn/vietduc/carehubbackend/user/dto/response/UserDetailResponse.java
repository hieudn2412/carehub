package vn.vietduc.carehubbackend.user.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import java.time.LocalDateTime;
import java.util.List;

@Builder
public record UserDetailResponse(
        Long id,
        String employeeCode,
        String fullName,
        String email,
        String phone,
        String departmentName,
        String positionName,
        List<Role> roles,
        UserStatus status,
        LocalDateTime lastLogin,
        LocalDateTime lastChangePassword,
        LocalDateTime createdAt,
        String updatedBy
) {
}
