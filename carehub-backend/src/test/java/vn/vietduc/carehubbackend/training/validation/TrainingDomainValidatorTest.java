package vn.vietduc.carehubbackend.training.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * L1 unit tests — sheet {@code BoundaryValues}, Test ID prefix {@code L1-BV} (IDs 01–10 and 25–27 live here).
 *
 * <p>Boundary references: BV-01 (manual declaredHours 0.5–999), BV-02 (evidence file size 1 byte–5 MB)
 * in SRS 4.5 Boundary Value Register; DC-01 for the start/end ordering rules; BR-04 / FR-017 for the
 * evidence size and type limits.
 */
class TrainingDomainValidatorTest {
    private static final LocalDate START = LocalDate.of(2026, 6, 1);

    private final TrainingDomainValidator validator = new TrainingDomainValidator();

    // ── Block: validateRecordForm() — declaredHours range (BV-01) ─────────────

    @ParameterizedTest(name = "declaredHours={0} → valid={1}")
    @CsvSource({
            "0.49, false",  // BVA-Min-1: below the 0.5 floor
            "0.5,  true",   // BVA-Min: exactly the floor
            "0.51, true",
            "999,  true",   // BVA-Max: exactly the ceiling
            "999.01, false" // BVA-Max+1: above the ceiling
    })
    @DisplayName("L1-BV-01 | BVA: manual declaredHours is accepted only within 0.5–999")
    void declaredHoursRangeBoundaries(BigDecimal declaredHours, boolean valid) {
        TrainingRecordFormRequest request = record(START, null, declaredHours);

        if (valid) {
            assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> validator.validateRecordForm(request, false))
                    .isInstanceOf(BadRequestException.class);
        }
    }

    @ParameterizedTest(name = "declaredHours={0}")
    @CsvSource({"0.01", "1000000"})
    @DisplayName("L1-BV-02 | BC-FALSE: legacyImport=true bypasses the declaredHours range entirely")
    void legacyImportBypassesHourRange(BigDecimal declaredHours) {
        TrainingRecordFormRequest request = record(START, null, declaredHours);

        assertThatCode(() -> validator.validateRecordForm(request, true)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-BV-03 | CC-FALSE: declaredHours null skips the range check")
    void nullDeclaredHoursSkipsRangeCheck() {
        TrainingRecordFormRequest request = record(START, null, null);

        assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-BV-04 | Negative: the too-many-hours message must state the enforced limit (D3)")
    void tooManyHoursMessageMustStateTheEnforcedLimit() {
        TrainingRecordFormRequest request = record(START, null, new BigDecimal("1000"));

        assertThatThrownBy(() -> validator.validateRecordForm(request, false))
                .isInstanceOf(BadRequestException.class)
                .as("D3: message must quote 999, the value actually enforced")
                .hasMessageContaining("999");
    }

    // ── Block: validateRecordForm() — DC-01 date and time ordering ────────────

    @ParameterizedTest(name = "endDate={0} → valid={1}")
    @CsvSource({
            "2026-05-31, false", // BVA-Min-1: one day before the start date
            "2026-06-01, true",  // BVA-Min: same day
            "2026-06-02, true"
    })
    @DisplayName("L1-BV-05 | BVA + DC-01: endDate must be on or after startDate")
    void endDateMustNotPrecedeStartDate(LocalDate endDate, boolean valid) {
        TrainingRecordFormRequest request = record(START, endDate, BigDecimal.ONE);

        if (valid) {
            assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> validator.validateRecordForm(request, false))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("End date");
        }
    }

    // ── Block: validateRecordForm() — the startDate == null partition (D16) ───

    @Test
    @DisplayName("L1-BV-25 | CC-FALSE: startDate null disables the endDate ordering check")
    void nullStartDateSkipsDateOrderingCheck() {
        // The merge added "startDate() != null &&" to this guard and dropped @NotNull from the DTO.
        // Before the merge this input was an NPE (endDate.isBefore(null)); now it is silently accepted.
        TrainingRecordFormRequest request = record(null, LocalDate.of(2026, 5, 31), BigDecimal.ONE);

        assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private static TrainingRecordFormRequest record(
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal declaredHours
    ) {
        return new TrainingRecordFormRequest(
                1L,
                2L,
                null,
                null,
                "Hội thảo kiểm soát nhiễm khuẩn",
                "Bệnh viện Việt Đức",
                null,
                startDate,
                endDate,
                declaredHours,
                DurationUnit.HOUR,
                null,
                declaredHours,
                null
        );
    }

    private static LocalDate parseDate(String value) {
        return value == null || "null".equals(value) ? null : LocalDate.parse(value);
    }

}
