package vn.vietduc.carehubbackend.training.dto.response;

import java.time.LocalDateTime;
import java.util.List;

public record TrainingGroupResponse(
        Long id,
        String name,
        String description,
        int memberCount,
        List<MemberInfo> members,
        boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public record MemberInfo(
            Long id,
            String employeeCode,
            String fullName,
            String departmentName
    ) {
    }
}
