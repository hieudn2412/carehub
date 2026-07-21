package vn.vietduc.carehubbackend.form.dto.response;

import lombok.Builder;

@Builder
public record UpdateFormScoringConfigurationResponse(
        FormScoringConfigurationResponse configuration,
        FormScoringRecalculationJobResponse job,
        boolean recalculationScheduled
) {}
