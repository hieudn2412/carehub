package vn.vietduc.carehubbackend.dashboard.dto;

import lombok.Builder;

import java.time.OffsetDateTime;
import java.util.List;

@Builder
public record DashboardFormFilterOptionsResponse(
        OffsetDateTime generatedAt,
        List<FormOption> forms,
        List<UserOption> subjects,
        List<UserOption> evaluators
) {
    @Builder
    public record FormOption(
            Long id,
            String code,
            String title
    ) {}

    @Builder
    public record UserOption(
            Long id,
            String employeeCode,
            String name
    ) {}
}
