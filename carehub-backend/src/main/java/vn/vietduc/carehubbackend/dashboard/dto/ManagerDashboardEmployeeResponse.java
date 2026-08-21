package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

@Builder
public record ManagerDashboardEmployeeResponse(
        boolean found,
        Long employeeId,
        String employeeCode,
        String fullName
) {
    public static ManagerDashboardEmployeeResponse notFound() {
        return ManagerDashboardEmployeeResponse.builder().found(false).build();
    }
}
