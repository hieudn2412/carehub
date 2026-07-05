package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Builder
public record DashboardUserSummaryResponse(
        OffsetDateTime generatedAt,
        int cacheTtlSeconds,
        long total,
        Map<String, Long> byStatus,
        long deleted,
        long firstLoginPending,
        long withoutDepartment,
        List<RoleCount> byRole
) {
    @Builder
    public record RoleCount(String roleCode, String roleName, long count) {}
}
