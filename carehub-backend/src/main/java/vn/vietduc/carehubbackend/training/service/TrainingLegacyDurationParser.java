package vn.vietduc.carehubbackend.training.service;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDurationParseResponse;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TrainingLegacyDurationParser {
    private static final Pattern HOUR_MINUTE = Pattern.compile("^(\\d{1,3})\\s*h\\s*(\\d{1,2})$");
    private static final Pattern NUMBER_WITH_UNIT = Pattern.compile("^(\\d{1,4}(?:[\\.,]\\d{1,2})?)\\s*(.+)$");
    private static final Pattern NUMBER_ONLY = Pattern.compile("^\\d{1,4}(?:[\\.,]\\d{1,2})?$");

    public TrainingDurationParseResponse parse(String rawText) {
        String raw = rawText == null ? "" : rawText.trim();
        if (raw.isBlank()) {
            return failed(raw, "Duration is missing");
        }

        String normalized = normalize(raw);
        Matcher hourMinute = HOUR_MINUTE.matcher(normalized);
        if (hourMinute.matches()) {
            BigDecimal hours = new BigDecimal(hourMinute.group(1));
            BigDecimal minutes = new BigDecimal(hourMinute.group(2));
            if (minutes.compareTo(BigDecimal.valueOf(59)) > 0) {
                return failed(raw, "Minute part must be between 0 and 59");
            }
            BigDecimal total = hours.add(minutes.divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP));
            return success(raw, total, DurationUnit.HOUR, total, BigDecimal.ONE, List.of(), true);
        }

        Matcher withUnit = NUMBER_WITH_UNIT.matcher(normalized);
        if (withUnit.matches()) {
            BigDecimal value = parseDecimal(withUnit.group(1));
            String unitText = withUnit.group(2).trim();
            if (isCredit(unitText)) {
                return success(raw, value, DurationUnit.CREDIT, null, confidence("0.60"),
                        List.of("Credit-to-hour conversion is not confirmed"), false);
            }
            if (isHour(unitText)) {
                return success(raw, value, DurationUnit.HOUR, value, BigDecimal.ONE, List.of(), true);
            }
            if (isLesson(unitText)) {
                return success(raw, value, DurationUnit.LESSON, null, confidence("0.65"),
                        List.of("Lesson-to-hour conversion is not confirmed"), false);
            }
            if (isMonth(unitText)) {
                return success(raw, value, DurationUnit.MONTH, null, confidence("0.30"),
                        List.of("Month duration requires manual review"), false);
            }
            if (isYear(unitText)) {
                return success(raw, value, DurationUnit.YEAR, null, confidence("0.30"),
                        List.of("Year duration requires manual review"), false);
            }
        }

        if (NUMBER_ONLY.matcher(normalized).matches()) {
            BigDecimal value = parseDecimal(normalized);
            List<String> warnings = new ArrayList<>();
            boolean largeLegacyValue = value.compareTo(BigDecimal.valueOf(24)) > 0;
            warnings.add(largeLegacyValue
                    ? "Large numeric legacy duration requires manager confirmation"
                    : "Duration has no explicit unit; confirm before committing as hours");
            return success(raw, value, DurationUnit.HOUR, value,
                    largeLegacyValue ? confidence("0.60") : confidence("0.85"), warnings, false);
        }

        return failed(raw, "Duration text cannot be parsed safely");
    }

    private TrainingDurationParseResponse success(
            String rawText,
            BigDecimal parsedValue,
            DurationUnit parsedUnit,
            BigDecimal normalizedHours,
            BigDecimal confidence,
            List<String> warningMessages,
            boolean autoCommittable
    ) {
        return new TrainingDurationParseResponse(
                rawText,
                scale(parsedValue),
                parsedUnit,
                scale(normalizedHours),
                confidence.setScale(2, RoundingMode.HALF_UP),
                warningMessages,
                true,
                autoCommittable
        );
    }

    private TrainingDurationParseResponse failed(String rawText, String message) {
        return new TrainingDurationParseResponse(
                rawText,
                null,
                null,
                null,
                BigDecimal.ZERO.setScale(2),
                List.of(message),
                false,
                false
        );
    }

    private BigDecimal parseDecimal(String value) {
        return new BigDecimal(value.replace(',', '.'));
    }

    private BigDecimal scale(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal confidence(String value) {
        return new BigDecimal(value);
    }

    private boolean isHour(String value) {
        return value.equals("h")
                || value.equals("gio")
                || value.equals("hour")
                || value.equals("hours");
    }

    private boolean isLesson(String value) {
        return value.equals("tiet")
                || value.equals("tiet dao tao");
    }

    private boolean isCredit(String value) {
        return value.equals("tin chi")
                || value.equals("gio tin chi")
                || value.equals("tin chi dao tao");
    }

    private boolean isMonth(String value) {
        return value.equals("thang");
    }

    private boolean isYear(String value) {
        return value.equals("nam");
    }

    private String normalize(String value) {
        String noAccent = Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return noAccent.toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }
}
