package vn.vietduc.carehubbackend.user.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.user.entity.Role;
import vn.vietduc.carehubbackend.user.entity.UserStatus;

import java.util.List;

@Builder
public record UserSummaryResponse(
        Long id,
        String employeeCode,
        String fullName,
        Long departmentId,
        String departmentName,
        String positionName,
        String educationLevelName,
        Boolean gender,
        java.time.LocalDate birthday,
        List<Role> roles,
        UserStatus status
) {
}
