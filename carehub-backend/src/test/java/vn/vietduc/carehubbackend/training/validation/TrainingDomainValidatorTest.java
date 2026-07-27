package vn.vietduc.carehubbackend.training.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.training.dto.request.RequirementFormRequest;
import vn.vietduc.carehubbackend.training.dto.request.TrainingRecordFormRequest;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

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
    private static final long ONE_MB = 1024L * 1024L;
    private static final long MAX_EVIDENCE_BYTES = 5 * ONE_MB;
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
        TrainingRecordFormRequest request = record(START, null, null, null, declaredHours);

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
        TrainingRecordFormRequest request = record(START, null, null, null, declaredHours);

        assertThatCode(() -> validator.validateRecordForm(request, true)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-BV-03 | CC-FALSE: declaredHours null skips the range check")
    void nullDeclaredHoursSkipsRangeCheck() {
        TrainingRecordFormRequest request = record(START, null, null, null, null);

        assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-BV-04 | Negative: the too-many-hours message must state the enforced limit (D3)")
    void tooManyHoursMessageMustStateTheEnforcedLimit() {
        TrainingRecordFormRequest request = record(START, null, null, null, new BigDecimal("1000"));

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
        TrainingRecordFormRequest request = record(START, endDate, null, null, BigDecimal.ONE);

        if (valid) {
            assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> validator.validateRecordForm(request, false))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("End date");
        }
    }

    @ParameterizedTest(name = "endDate={0}, startTime={1}, endTime={2} → valid={3}")
    @CsvSource({
            // The time check only applies on a single-day record with both times present.
            "null,       09:00, 08:00, false", // endDate null, endTime before startTime → rejected
            "2026-06-01, 09:00, 08:00, false", // same day, endTime before startTime → rejected
            "2026-06-01, 09:00, 09:00, true",  // BVA: equal times are allowed
            "2026-06-01, 09:00, 10:00, true",
            "2026-06-02, 09:00, 08:00, true",  // multi-day record: time ordering is not checked
            "2026-06-01, null,  08:00, true",  // startTime missing → check skipped
            "2026-06-01, 09:00, null,  true"   // endTime missing → check skipped
    })
    @DisplayName("L1-BV-06 | CC: the five-term time-ordering guard, each sub-condition driven independently")
    void timeOrderingGuardTruthTable(String endDate, String startTime, String endTime, boolean valid) {
        TrainingRecordFormRequest request = record(
                START,
                parseDate(endDate),
                parseTime(startTime),
                parseTime(endTime),
                BigDecimal.ONE);

        if (valid) {
            assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> validator.validateRecordForm(request, false))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("End time");
        }
    }

    // ── Block: validateEvidenceMetadata() — BV-02, BR-04, FR-017 ─────────────

    @ParameterizedTest(name = "size={0} bytes → valid={1}")
    @CsvSource({
            "-1,      false", // negative size
            "0,       false", // BVA-Min-1: empty file
            "1,       true",  // BVA-Min: smallest accepted file
            "5242880, true",  // BVA-Max: exactly 5 MB
            "5242881, false"  // BVA-Max+1: one byte over 5 MB
    })
    @DisplayName("L1-BV-07 | BVA: evidence size is accepted only in (0, 5 MB]")
    void evidenceSizeBoundaries(long fileSizeBytes, boolean valid) {
        if (valid) {
            assertThatCode(() -> validator.validateEvidenceMetadata("image/jpeg", fileSizeBytes))
                    .doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> validator.validateEvidenceMetadata("image/jpeg", fileSizeBytes))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("5 MB");
        }
    }

    @Test
    @DisplayName("L1-BV-08 | EP: only image/jpeg, image/png and application/pdf are accepted")
    void evidenceMimeTypePartitions() {
        for (String allowed : new String[]{"image/jpeg", "image/png", "application/pdf"}) {
            assertThatCode(() -> validator.validateEvidenceMetadata(allowed, ONE_MB))
                    .as("allowed MIME type %s", allowed)
                    .doesNotThrowAnyException();
        }
        for (String rejected : new String[]{"image/gif", "image/webp", "application/msword", "text/plain"}) {
            assertThatThrownBy(() -> validator.validateEvidenceMetadata(rejected, ONE_MB))
                    .as("rejected MIME type %s", rejected)
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("JPG, PNG hoặc PDF");
        }
    }

    @Test
    @DisplayName("L1-BV-10 | EP-Invalid + Negative: a missing MIME type must be a 400, not an NPE (D12)")
    void missingMimeTypeMustBeRejectedAsBadRequest() {
        assertThatThrownBy(() -> validator.validateEvidenceMetadata(null, ONE_MB))
                .as("D12: a null MIME type must produce a BadRequestException, not an NPE")
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("JPG, PNG hoặc PDF");
    }

    // ── Block: validateRecordForm() — the startDate == null partition (D16) ───

    @Test
    @DisplayName("L1-BV-25 | CC-FALSE: startDate null disables the endDate ordering check")
    void nullStartDateSkipsDateOrderingCheck() {
        // The merge added "startDate() != null &&" to this guard and dropped @NotNull from the DTO.
        // Before the merge this input was an NPE (endDate.isBefore(null)); now it is silently accepted.
        TrainingRecordFormRequest request = record(null, LocalDate.of(2026, 5, 31), null, null, BigDecimal.ONE);

        assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-BV-26 | CC-FALSE: startDate null also disables the time ordering check (D16)")
    void nullStartDateSkipsTimeOrderingCheck() {
        // Pre-merge this threw BadRequestException("End time must be greater than or equal to start
        // time") because the old guard short-circuited on endDate == null and reached the time
        // comparison. The new first conjunct turns a rejected record into an accepted one, so DC-01
        // is no longer enforced when startDate is absent — tracked as D16.
        TrainingRecordFormRequest request = record(
                null, null, LocalTime.of(9, 0), LocalTime.of(8, 0), BigDecimal.ONE);

        assertThatCode(() -> validator.validateRecordForm(request, false)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("L1-BV-27 | BVA-Min: the 5 MB evidence ceiling is exactly 5 242 880 bytes")
    void evidenceCeilingIsFiveMegabytes() {
        // Pins the production constant by driving the validator, not by comparing the test's own
        // copy of it against itself.
        assertThatCode(() -> validator.validateEvidenceMetadata("image/jpeg", 5_242_880L))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> validator.validateEvidenceMetadata("image/jpeg", 5_242_881L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("5 MB");
        assertThat(MAX_EVIDENCE_BYTES)
                .as("the test fixture must track the production limit")
                .isEqualTo(5_242_880L);
    }

    // ── Block: validateRequirementForm() ─────────────────────────────────────

    @ParameterizedTest(name = "effectiveTo={0} → valid={1}")
    @CsvSource({
            "2026-05-31, false", // BVA-Min-1: ends before it starts
            "2026-06-01, true",  // BVA-Min: same day
            "2027-06-01, true",
            "null,       true"   // open-ended requirement
    })
    @DisplayName("L1-BV-09 | BVA: requirement effectiveTo must be on or after effectiveFrom")
    void requirementDateRangeBoundaries(String effectiveTo, boolean valid) {
        RequirementFormRequest request = new RequirementFormRequest(
                "REQ-01",
                "CME 5 năm",
                new BigDecimal("120"),
                5,
                null,
                null,
                null,
                new BigDecimal("80"),
                START,
                parseDate(effectiveTo),
                true,
                null
        );

        if (valid) {
            assertThatCode(() -> validator.validateRequirementForm(request)).doesNotThrowAnyException();
        } else {
            assertThatThrownBy(() -> validator.validateRequirementForm(request))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessageContaining("effective_to");
        }
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private static TrainingRecordFormRequest record(
            LocalDate startDate,
            LocalDate endDate,
            LocalTime startTime,
            LocalTime endTime,
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
                startTime,
                endTime,
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

    private static LocalTime parseTime(String value) {
        return value == null || "null".equals(value) ? null : LocalTime.parse(value);
    }
}
