package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import vn.vietduc.carehubbackend.training.dto.response.TrainingDurationParseResponse;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L1 unit tests — sheet {@code BoundaryValues}, Test ID prefix {@code L1-BV} (IDs 11–19 live here).
 *
 * <p>Boundary references: BV-05 (the {@code NhMM} minute part must be 0–59) and BV-06 (a bare numeric
 * legacy duration above 24 drops confidence from 0.85 to 0.60 and requires manager confirmation)
 * in SRS 4.5 Boundary Value Register.
 */
class TrainingLegacyDurationParserTest {
    private final TrainingLegacyDurationParser parser = new TrainingLegacyDurationParser();

    // ── Block: parse() — "NhMM" minute boundary (BV-04) ───────────────────────

    @ParameterizedTest(name = "\"{0}\" → parsed={1}, hours={2}")
    @CsvSource({
            "2h0,  true,  2.00",   // BVA-Min: zero minutes
            "2h30, true,  2.50",
            "2h59, true,  2.98",   // BVA-Max: last valid minute (59/60 = 0.983 → 0.98)
            "2h60, false, null",   // BVA-Max+1: 60 minutes is rejected
            "2h99, false, null"
    })
    @DisplayName("L1-BV-11 | BVA: the minute part of NhMM is accepted only in 0–59")
    void hourMinuteMinuteBoundaries(String raw, boolean parsed, String expectedHours) {
        TrainingDurationParseResponse result = parser.parse(raw);

        assertThat(result.parsed()).isEqualTo(parsed);
        if (parsed) {
            assertThat(result.parsedUnit()).isEqualTo(DurationUnit.HOUR);
            assertThat(result.normalizedHours()).isEqualByComparingTo(expectedHours);
            assertThat(result.autoCommittable()).isTrue();
        } else {
            assertThat(result.normalizedHours()).isNull();
            assertThat(result.warningMessages()).contains("Minute part must be between 0 and 59");
        }
    }

    // ── Block: parse() — bare numeric legacy value threshold (BV-05) ──────────

    @ParameterizedTest(name = "\"{0}\" → confidence={1}")
    @CsvSource({
            "1,   0.85",  // BVA-Min: small value, higher confidence
            "24,  0.85",  // BVA-Max: exactly 24 is still the "small" partition
            "25,  0.60",  // BVA-Max+1: above 24 drops to the low-confidence partition
            "330, 0.60"
    })
    @DisplayName("L1-BV-12 | BVA: a bare number above 24 drops confidence from 0.85 to 0.60")
    void bareNumberConfidenceThreshold(String raw, String expectedConfidence) {
        TrainingDurationParseResponse result = parser.parse(raw);

        assertThat(result.parsed()).isTrue();
        assertThat(result.parsedUnit()).isEqualTo(DurationUnit.HOUR);
        assertThat(result.confidence()).isEqualByComparingTo(expectedConfidence);
        assertThat(result.autoCommittable()).isFalse();
        assertThat(result.warningMessages()).hasSize(1);
    }

    @Test
    @DisplayName("L1-BV-13 | BVA-Max+1: the bare-number pattern caps at 4 integer digits")
    void bareNumberPatternCapsAtFourDigits() {
        assertThat(parser.parse("9999").parsed()).isTrue();
        assertThat(parser.parse("10000").parsed()).isFalse();
    }

    // ── Block: parse() — unit partitions (EP) ─────────────────────────────────

    @ParameterizedTest(name = "\"{0}\" → {1}, normalizedHours set={2}, autoCommittable={3}")
    @CsvSource({
            "2h,           HOUR,   true,  true",
            "'1,5 giờ',    HOUR,   true,  true",
            "2 hours,      HOUR,   true,  true",
            "2 tiết,       LESSON, false, false",
            "18 tín chỉ,   CREDIT, false, false",
            "1 tháng,      MONTH,  false, false",
            "2 năm,        YEAR,   false, false"
    })
    @DisplayName("L1-BV-14 | EP: each duration unit maps to its own partition and conversion policy")
    void unitPartitions(String raw, DurationUnit unit, boolean hoursSet, boolean autoCommittable) {
        TrainingDurationParseResponse result = parser.parse(raw);

        assertThat(result.parsed()).isTrue();
        assertThat(result.parsedUnit()).isEqualTo(unit);
        assertThat(result.normalizedHours() != null).isEqualTo(hoursSet);
        assertThat(result.autoCommittable()).isEqualTo(autoCommittable);
    }

    @Test
    @DisplayName("L1-BV-15 | EP: accents and casing are normalised before the unit is matched")
    void unitMatchingIsAccentInsensitive() {
        assertThat(parser.parse("2 GIỜ").parsedUnit()).isEqualTo(DurationUnit.HOUR);
        assertThat(parser.parse("2 gio").parsedUnit()).isEqualTo(DurationUnit.HOUR);
        assertThat(parser.parse("18 TÍN CHỈ").parsedUnit()).isEqualTo(DurationUnit.CREDIT);
        assertThat(parser.parse("2 TIẾT").parsedUnit()).isEqualTo(DurationUnit.LESSON);
    }

    @Test
    @DisplayName("L1-BV-19 | EP-Invalid: units containing đ must normalise too (D13)")
    void unitsContainingDStrokeMustNormalise() {
        // EXPECTED TO FAIL until D13 is resolved. normalize() strips combining marks via NFD, but
        // U+0111 (đ) is a distinct letter that NFD does not decompose, so the text stays "tiet đao
        // tao" and never equals the "tiet dao tao" constant in isLesson(). Same for "gio tin chi"
        // and "tin chi dao tao" in isCredit(). Those branches are unreachable for real input.
        assertThat(parser.parse("2 tiết đào tạo").parsedUnit())
                .as("D13: \"tiết đào tạo\" must be recognised as the LESSON unit")
                .isEqualTo(DurationUnit.LESSON);
    }

    // ── Block: parse() — unparseable input (EP-Invalid) ───────────────────────

    @ParameterizedTest(name = "\"{0}\"")
    @ValueSource(strings = {"O3", "toàn thời gian", "2 tuần", "abc", "   ", ""})
    @DisplayName("L1-BV-16 | EP-Invalid: unparseable text returns parsed=false with confidence 0")
    void unparseableInputIsRejected(String raw) {
        TrainingDurationParseResponse result = parser.parse(raw);

        assertThat(result.parsed()).isFalse();
        assertThat(result.normalizedHours()).isNull();
        assertThat(result.parsedUnit()).isNull();
        assertThat(result.confidence()).isEqualByComparingTo("0.00");
        assertThat(result.autoCommittable()).isFalse();
        assertThat(result.warningMessages()).isNotEmpty();
    }

    @Test
    @DisplayName("L1-BV-17 | EP-Invalid: null input is treated as missing, not as a crash")
    void nullInputIsTreatedAsMissing() {
        TrainingDurationParseResponse result = parser.parse(null);

        assertThat(result.parsed()).isFalse();
        assertThat(result.warningMessages()).contains("Duration is missing");
    }

    @Test
    @DisplayName("L1-BV-18 | EP-Valid: explicit hour formats normalise to two decimal places")
    void explicitHourFormatsNormaliseToTwoDecimals() {
        assertThat(parser.parse("2h").normalizedHours()).isEqualByComparingTo("2.00");
        assertThat(parser.parse("2h30").normalizedHours()).isEqualByComparingTo("2.50");
        assertThat(parser.parse("1,5 giờ").normalizedHours()).isEqualByComparingTo("1.50");
        assertThat(parser.parse("1.5 giờ").normalizedHours()).isEqualByComparingTo("1.50");
        assertThat(parser.parse("1,5 giờ").warningMessages()).isEmpty();
    }
}
