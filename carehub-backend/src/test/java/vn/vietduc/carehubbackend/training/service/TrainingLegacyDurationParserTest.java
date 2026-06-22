package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import static org.assertj.core.api.Assertions.assertThat;

class TrainingLegacyDurationParserTest {
    private final TrainingLegacyDurationParser parser = new TrainingLegacyDurationParser();

    @Test
    void parsesExplicitHourDurationsIntoNormalizedHours() {
        var shortHour = parser.parse("2h");
        assertThat(shortHour.parsed()).isTrue();
        assertThat(shortHour.parsedUnit()).isEqualTo(DurationUnit.HOUR);
        assertThat(shortHour.normalizedHours()).isEqualByComparingTo("2.00");

        var hourMinute = parser.parse("2h30");
        assertThat(hourMinute.parsed()).isTrue();
        assertThat(hourMinute.parsedUnit()).isEqualTo(DurationUnit.HOUR);
        assertThat(hourMinute.normalizedHours()).isEqualByComparingTo("2.50");
        assertThat(hourMinute.autoCommittable()).isTrue();

        var commaHour = parser.parse("1,5 giờ");
        assertThat(commaHour.parsed()).isTrue();
        assertThat(commaHour.normalizedHours()).isEqualByComparingTo("1.50");
        assertThat(commaHour.warningMessages()).isEmpty();
    }

    @Test
    void parsesUnconfirmedUnitsWithoutConvertingToHours() {
        var lesson = parser.parse("2 tiết");
        assertThat(lesson.parsed()).isTrue();
        assertThat(lesson.parsedUnit()).isEqualTo(DurationUnit.LESSON);
        assertThat(lesson.normalizedHours()).isNull();
        assertThat(lesson.autoCommittable()).isFalse();

        var credit = parser.parse("18 tín chỉ");
        assertThat(credit.parsed()).isTrue();
        assertThat(credit.parsedUnit()).isEqualTo(DurationUnit.CREDIT);
        assertThat(credit.normalizedHours()).isNull();
        assertThat(credit.warningMessages()).contains("Credit-to-hour conversion is not confirmed");

        var month = parser.parse("1 tháng");
        assertThat(month.parsed()).isTrue();
        assertThat(month.parsedUnit()).isEqualTo(DurationUnit.MONTH);
        assertThat(month.normalizedHours()).isNull();

        var year = parser.parse("2 năm");
        assertThat(year.parsed()).isTrue();
        assertThat(year.parsedUnit()).isEqualTo(DurationUnit.YEAR);
        assertThat(year.normalizedHours()).isNull();
    }

    @Test
    void flagsAmbiguousAndInvalidDurations() {
        var plainNumber = parser.parse("2.0");
        assertThat(plainNumber.parsed()).isTrue();
        assertThat(plainNumber.parsedUnit()).isEqualTo(DurationUnit.HOUR);
        assertThat(plainNumber.normalizedHours()).isEqualByComparingTo("2.00");
        assertThat(plainNumber.autoCommittable()).isFalse();

        var longLegacyNumber = parser.parse("143");
        assertThat(longLegacyNumber.parsed()).isTrue();
        assertThat(longLegacyNumber.warningMessages()).contains("Large numeric legacy duration requires manager confirmation");

        var largeNumber = parser.parse("330");
        assertThat(largeNumber.parsed()).isTrue();
        assertThat(largeNumber.normalizedHours()).isEqualByComparingTo("330.00");
        assertThat(largeNumber.autoCommittable()).isFalse();
        assertThat(largeNumber.warningMessages()).contains("Large numeric legacy duration requires manager confirmation");

        var invalid = parser.parse("O3");
        assertThat(invalid.parsed()).isFalse();
        assertThat(invalid.normalizedHours()).isNull();

        var fullTime = parser.parse("toàn thời gian");
        assertThat(fullTime.parsed()).isFalse();
    }
}
