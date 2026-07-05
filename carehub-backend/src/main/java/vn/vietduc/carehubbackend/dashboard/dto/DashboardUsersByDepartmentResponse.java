package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.List;

@Builder
public record DashboardUsersByDepartmentResponse(
        OffsetDateTime generatedAt,
        int cacheTtlSeconds,
        List<Item> items
) {
    @Builder
    public record Item(
            Long departmentId,
            String departmentCode,
            String departmentName,
            long total,
            long active,
            long inactive,
            long locked
    ) {}
}
