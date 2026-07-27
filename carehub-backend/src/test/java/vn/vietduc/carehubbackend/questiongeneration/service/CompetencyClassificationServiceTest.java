package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.questiongeneration.entity.CompetencyThresholdConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.CompetencyThresholdConfigRepository;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * L1 unit tests — sheet {@code CompetencyClassificationService}, Test ID prefix {@code L1-CCS}.
 *
 * <p>SRS traceability caveats (see docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md):
 * <ul>
 *   <li><b>D6</b> — BR-01 / FR-052 describe Good/Average/Weak tiers over 0–100; the implementation
 *       uses five {@link CompetencyLevel} tiers over 0–10. The tests assert the implementation.</li>
 *   <li><b>D5</b> — DC-05 requires contiguous bands. Seeded neighbors share a boundary and
 *       {@code classify()} assigns that shared point to the later, higher band.</li>
 * </ul>
 */
class CompetencyClassificationServiceTest {
    private final CompetencyThresholdConfigRepository thresholdRepository =
            mock(CompetencyThresholdConfigRepository.class);
    private final CompetencyClassificationService service =
            new CompetencyClassificationService(thresholdRepository);

    // ── Block: classify() with no persisted config → classifyWithDefaults() ───

    @ParameterizedTest(name = "score={0} → {1}")
    @CsvSource({
            "0,    NOT_COMPETENT",   // BVA-Min of the whole scale
            "3.99, NOT_COMPETENT",   // BVA-Max-1 of the NOT_COMPETENT band
            "4.0,  BEGINNER",        // BVA-Min: first value of BEGINNER
            "5.99, BEGINNER",
            "6.0,  BASIC",           // BVA-Min: first value of BASIC
            "7.49, BASIC",
            "7.5,  PROFICIENT",      // BVA-Min: first value of PROFICIENT
            "8.99, PROFICIENT",
            "9.0,  ADVANCED",        // BVA-Min: first value of ADVANCED
            "10,   ADVANCED"         // BVA-Max of the whole scale
    })
    @DisplayName("L1-CCS-01 | BVA: default bands classify every boundary of the 0–10 scale")
    void defaultBandsCoverEveryBoundary(BigDecimal score, CompetencyLevel expected) {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of());

        assertThat(service.classifyOverall(score)).isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-CCS-02 | EP-Invalid: null score → NOT_COMPETENT without touching the repository")
    void nullScoreIsNotCompetent() {
        assertThat(service.classifyOverall(null)).isEqualTo(CompetencyLevel.NOT_COMPETENT);
    }

    @Test
    @DisplayName("L1-CCS-03 | BVA-Max+1: score above 10 is clamped to 10 → ADVANCED")
    void scoreAboveTenIsClampedToAdvanced() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of());

        assertThat(service.classifyOverall(BigDecimal.valueOf(42))).isEqualTo(CompetencyLevel.ADVANCED);
    }

    @Test
    @DisplayName("L1-CCS-04 | EP-Invalid: negative score → NOT_COMPETENT")
    void negativeScoreIsNotCompetent() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of());

        assertThat(service.classifyOverall(BigDecimal.valueOf(-1))).isEqualTo(CompetencyLevel.NOT_COMPETENT);
    }

    // ── Block: classify() with persisted config ───────────────────────────────

    @Test
    @DisplayName("L1-CCS-05 | BC-FALSE: global thresholds are read when category is null")
    void nullCategoryReadsGlobalThresholds() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc())
                .thenReturn(List.of(band(CompetencyLevel.BASIC, "0", "10")));

        assertThat(service.classify(BigDecimal.valueOf(5), null)).isEqualTo(CompetencyLevel.BASIC);
    }

    @Test
    @DisplayName("L1-CCS-06 | BC-TRUE: category thresholds are read when a category is supplied")
    void categoryReadsCategoryThresholds() {
        QuestionCategory category = QuestionCategory.builder().code("IC").name("Kiểm soát nhiễm khuẩn").build();
        when(thresholdRepository.findByCategoryOrderBySortOrderAsc(category))
                .thenReturn(List.of(band(CompetencyLevel.PROFICIENT, "0", "10")));

        assertThat(service.classify(BigDecimal.valueOf(5), category)).isEqualTo(CompetencyLevel.PROFICIENT);
    }

    @ParameterizedTest(name = "score={0} → {1}")
    @CsvSource({
            "0,   NOT_COMPETENT",
            "4,   NOT_COMPETENT",   // BVA-Max: inclusive upper edge of the band
            "4.1, BEGINNER",        // BVA-Min: inclusive lower edge of the next band
            "7,   BEGINNER",
            "7.1, ADVANCED",
            "10,  ADVANCED"         // BVA-Max of the configured range
    })
    @DisplayName("L1-CCS-07 | BVA: configured contiguous bands match inclusively on both edges")
    void configuredBandsMatchInclusively(BigDecimal score, CompetencyLevel expected) {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of(
                band(CompetencyLevel.NOT_COMPETENT, "0", "4"),
                band(CompetencyLevel.BEGINNER, "4.1", "7"),
                band(CompetencyLevel.ADVANCED, "7.1", "10")
        ));

        assertThat(service.classifyOverall(score)).isEqualTo(expected);
    }

    @Test
    @DisplayName("L1-CCS-08 | BC-TRUE: bands configured on a 0–100 scale are divided by 10 (self-healing)")
    void hundredPointScaleIsRescaledToTen() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of(
                band(CompetencyLevel.NOT_COMPETENT, "0", "40"),
                band(CompetencyLevel.BEGINNER, "41", "70"),
                band(CompetencyLevel.ADVANCED, "71", "100")
        ));

        // A 10-point score of 5.0 sits in 41..70 once the bands are divided by 10.
        assertThat(service.classifyOverall(BigDecimal.valueOf(5))).isEqualTo(CompetencyLevel.BEGINNER);
        assertThat(service.classifyOverall(BigDecimal.valueOf(9))).isEqualTo(CompetencyLevel.ADVANCED);
    }

    @Test
    @DisplayName("L1-CCS-09 | BC-FALSE: all maxScore <= 10 → no rescaling applied")
    void tenPointScaleIsNotRescaled() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of(
                band(CompetencyLevel.NOT_COMPETENT, "0", "4"),
                band(CompetencyLevel.ADVANCED, "4.1", "10")
        ));

        assertThat(service.classifyOverall(BigDecimal.valueOf(4))).isEqualTo(CompetencyLevel.NOT_COMPETENT);
    }

    @Test
    @DisplayName("L1-CCS-10 | CC: a band with a null bound is skipped instead of matching")
    void bandWithNullBoundIsSkipped() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of(
                band(CompetencyLevel.BEGINNER, null, "5"),
                band(CompetencyLevel.BASIC, "0", "10")
        ));

        assertThat(service.classifyOverall(BigDecimal.valueOf(3))).isEqualTo(CompetencyLevel.BASIC);
    }

    @Test
    @DisplayName("L1-CCS-11 | EP-Invalid: score outside every configured band → highest band (fallback)")
    void scoreOutsideAllBandsFallsBackToHighestBand() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc()).thenReturn(List.of(
                band(CompetencyLevel.NOT_COMPETENT, "0", "3"),
                band(CompetencyLevel.BEGINNER, "4", "6")
        ));

        assertThat(service.classifyOverall(BigDecimal.valueOf(9))).isEqualTo(CompetencyLevel.BEGINNER);
    }

    // ── Block: defaultThresholds() — the seed band set ─────────────────────────

    @Test
    @DisplayName("L1-CCS-12 | EP-Valid: defaultThresholds seeds five ordered bands spanning 0–10")
    void defaultThresholdsSeedFiveOrderedBands() {
        List<CompetencyThresholdConfig> defaults = CompetencyClassificationService.defaultThresholds();

        assertThat(defaults).hasSize(5);
        assertThat(defaults).extracting(CompetencyThresholdConfig::getCompetencyLevel)
                .containsExactly(
                        CompetencyLevel.NOT_COMPETENT,
                        CompetencyLevel.BEGINNER,
                        CompetencyLevel.BASIC,
                        CompetencyLevel.PROFICIENT,
                        CompetencyLevel.ADVANCED);
        assertThat(defaults).extracting(CompetencyThresholdConfig::getSortOrder)
                .containsExactly(1, 2, 3, 4, 5);
        assertThat(defaults.get(0).getMinScore()).isEqualByComparingTo("0");
        assertThat(defaults.get(4).getMaxScore()).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("L1-CCS-13 | BVA + DC-05: seeded bands must leave no gap between one band's max and the next min")
    void seededBandsMustBeContiguous() {
        List<CompetencyThresholdConfig> defaults = CompetencyClassificationService.defaultThresholds();

        for (int i = 0; i < defaults.size() - 1; i++) {
            BigDecimal currentMax = defaults.get(i).getMaxScore();
            BigDecimal nextMin = defaults.get(i + 1).getMinScore();

            assertThat(currentMax)
                    .as("DC-05: band %s max (%s) must meet band %s min (%s) with no gap",
                            defaults.get(i).getCompetencyLevel(), currentMax,
                            defaults.get(i + 1).getCompetencyLevel(), nextMin)
                    .isEqualByComparingTo(nextMin);
        }
    }

    @Test
    @DisplayName("L1-CCS-14 | BVA + DC-05: a score inside a seeded band gap must not classify as ADVANCED")
    void scoreInsideSeededBandGapMustNotBecomeAdvanced() {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc())
                .thenReturn(CompetencyClassificationService.defaultThresholds());

        assertThat(service.classifyOverall(new BigDecimal("3.995")))
                .as("a near-zero score must never be classified as the top tier")
                .isEqualTo(CompetencyLevel.NOT_COMPETENT);
    }

    @ParameterizedTest(name = "persisted default score={0} → {1}")
    @CsvSource({
            "4.0, BEGINNER",
            "6.0, BASIC",
            "7.5, PROFICIENT",
            "9.0, ADVANCED"
    })
    @DisplayName("L1-CCS-15 | BVA: shared seeded boundaries belong to the higher band")
    void persistedDefaultBoundariesMatchFallbackDefaults(BigDecimal score, CompetencyLevel expected) {
        when(thresholdRepository.findByCategoryIsNullOrderBySortOrderAsc())
                .thenReturn(CompetencyClassificationService.defaultThresholds());

        assertThat(service.classifyOverall(score)).isEqualTo(expected);
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private static CompetencyThresholdConfig band(CompetencyLevel level, String min, String max) {
        return CompetencyThresholdConfig.builder()
                .competencyLevel(level)
                .minScore(min == null ? null : new BigDecimal(min))
                .maxScore(max == null ? null : new BigDecimal(max))
                .build();
    }
}
