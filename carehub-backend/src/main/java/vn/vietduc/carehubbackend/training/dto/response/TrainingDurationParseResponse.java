package vn.vietduc.carehubbackend.training.dto.response;

import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.util.List;

public record TrainingDurationParseResponse(
        String rawText,
        BigDecimal parsedValue,
        DurationUnit parsedUnit,
        BigDecimal normalizedHours,
        BigDecimal confidence,
        List<String> warningMessages,
        boolean parsed,
        boolean autoCommittable
) {
}
