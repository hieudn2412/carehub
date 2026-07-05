package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.time.Instant;
import java.util.List;

@Builder
public record DashboardRecentActivityResponse(List<Item> items) {
    @Builder
    public record Item(
            DashboardActivityType type,
            Instant occurredAt,
            String title,
            Long formId,
            String formCode,
            Long submissionId,
            Long assignmentId,
            Actor actor
    ) {}

    @Builder
    public record Actor(String employeeCode, String fullName) {}
}
