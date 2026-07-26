package vn.vietduc.carehubbackend.user.dto.response;

import lombok.Builder;
import vn.vietduc.carehubbackend.user.entity.Department;

import java.time.LocalDateTime;

@Builder
public record DepartmentResponse(
        Long id,
        String departmentCode,
        String name,
        long employeeCount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static DepartmentResponse from(Department department) {
        return from(department, 0L);
    }

    public static DepartmentResponse from(Department department, long employeeCount) {
        return DepartmentResponse.builder()
                .id(department.getId())
                .departmentCode(department.getDepartmentCode())
                .name(department.getName())
                .employeeCount(employeeCount)
                .createdAt(department.getCreatedAt())
                .updatedAt(department.getUpdatedAt())
                .build();
    }
}
