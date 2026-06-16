package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;

public record TrainingActivityTypeOptionResponse(
        Long id,
        String code,
        String name,
        DurationUnit defaultDurationUnit,
        boolean requiresEvidence,
        BigDecimal maxCreditedHoursPerRecord
) {
}
