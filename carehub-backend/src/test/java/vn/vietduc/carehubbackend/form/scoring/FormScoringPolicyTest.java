package vn.vietduc.carehubbackend.form.scoring;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.*;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L1 unit tests — sheet {@code FormScoringPolicy}, Test ID prefix {@code L1-FSP}.
 * Pure calculation: constructed directly, no mocks.
 *
 * <p>SRS note: DC-04 requires criterion weights to sum to exactly 100%, but this policy normalises
 * per-question coefficients against their group total instead of enforcing a 100% sum. See D8 in
 * docs/l1-unit-tests/SRS-CODE-DIVERGENCE.md; the tests below assert the implemented normalisation.
 */
class FormScoringPolicyTest {
    private final FormScoringPolicy policy = new FormScoringPolicy();

    // ── Block: resolve() — the four "not configured" branches ─────────────────

    @Test
    @DisplayName("L1-FSP-01 | BC-TRUE: version with no scored question → NOT configured")
    void versionWithoutScoredQuestionsIsNotConfigured() {
        FormVersion version = version();

        assertThat(policy.resolve(version).configured()).isFalse();
    }

    @Test
    @DisplayName("L1-FSP-02 | CC: question with zero options → NOT configured (options.isEmpty() = TRUE)")
    void questionWithoutOptionsIsNotConfigured() {
        FormQuestion question = bareQuestion("NO_OPTIONS", false);
        FormVersion version = version(question);

        assertThat(policy.resolve(version).configured()).isFalse();
    }

    @Test
    @DisplayName("L1-FSP-03 | CC: option with null scoreValue → NOT configured (second sub-condition TRUE)")
    void questionWithUnscoredOptionIsNotConfigured() {
        FormQuestion question = bareQuestion("NULL_SCORE", false);
        question.getOptions().add(option(question, null));
        FormVersion version = version(question);

        assertThat(policy.resolve(version).configured()).isFalse();
    }

    @Test
    @DisplayName("L1-FSP-04 | BVA-Min: every option scores 0 → maxScore <= 0 → NOT configured")
    void allZeroScoresYieldNotConfigured() {
        FormQuestion question = bareQuestion("ALL_ZERO", false);
        question.getOptions().addAll(List.of(option(question, "0"), option(question, "0")));

        assertThat(policy.resolve(version(question)).configured()).isFalse();
    }

    // ── Block: scoredQuestions() — the two filter sub-conditions ──────────────

    @ParameterizedTest(name = "itemType={0}")
    @CsvSource({"TITLE_DESCRIPTION", "IMAGE", "INSTRUCTION"})
    @DisplayName("L1-FSP-05 | CC: non-QUESTION item types are excluded from scoring")
    void nonQuestionItemTypesAreExcluded(FormItemType itemType) {
        FormQuestion decoration = question("DECOR", false);
        decoration.setItemType(itemType);

        assertThat(policy.scoredQuestions(version(decoration))).isEmpty();
    }

    @Test
    @DisplayName("L1-FSP-06 | CC: excludeFromScore=true questions are excluded, the rest kept")
    void excludedQuestionsAreFilteredOut() {
        FormQuestion scored = question("SCORED", false);
        FormQuestion excluded = question("EXCLUDED", false);
        excluded.setExcludeFromScore(true);

        assertThat(policy.scoredQuestions(version(scored, excluded)))
                .extracting(FormQuestion::getCode)
                .containsExactly("SCORED");
    }

    // ── Block: criticalWeightPercent() ────────────────────────────────────────

    @Test
    @DisplayName("L1-FSP-07 | EP-Valid: no scoring settings → default 60%")
    void criticalWeightDefaultsToSixty() {
        FormVersion version = version(question("N", false), question("C", true));

        assertThat(policy.criticalWeightPercent(version))
                .isEqualByComparingTo(FormScoringPolicy.DEFAULT_CRITICAL_WEIGHT_PERCENT);
        assertThat(policy.hasConfiguredCriticalWeight(version)).isFalse();
    }

    @Test
    @DisplayName("L1-FSP-08 | BC-FALSE: settingsJson null → default 60% without NPE")
    void nullSettingsJsonFallsBackToDefault() {
        FormVersion version = version(question("N", false));
        version.setSettingsJson(null);

        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("60");
        assertThat(policy.hasConfiguredCriticalWeight(version)).isFalse();
    }

    @Test
    @DisplayName("L1-FSP-09 | EP-Invalid: non-numeric criticalWeightPercent → sentinel -1")
    void nonNumericCriticalWeightReturnsSentinel() {
        FormVersion version = version(question("N", false));
        version.setSettingsJson(new LinkedHashMap<>(Map.of(
                "scoring", new LinkedHashMap<>(Map.of("criticalWeightPercent", "sáu mươi")))));

        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("-1");
    }

    @ParameterizedTest(name = "criticalWeightPercent={0}")
    @CsvSource({"0", "1", "60", "99", "100"})
    @DisplayName("L1-FSP-10 | BVA: 0 and 100 boundaries round-trip through set/read")
    void criticalWeightBoundariesRoundTrip(BigDecimal value) {
        FormVersion version = version(question("N", false), question("C", true));

        policy.setCriticalWeightPercent(version, value);

        assertThat(policy.hasConfiguredCriticalWeight(version)).isTrue();
        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo(value);
    }

    @Test
    @DisplayName("L1-FSP-11 | State: setCriticalWeightPercent preserves unrelated settings keys")
    void settingUpdatesScoringWithoutDroppingOtherSettings() {
        FormVersion version = version(question("N", false));
        version.setSettingsJson(new LinkedHashMap<>(Map.of("theme", "dark")));

        policy.setCriticalWeightPercent(version, new BigDecimal("40"));

        assertThat(version.getSettingsJson()).containsEntry("theme", "dark");
        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("40");
    }

    // ── Block: effectiveGroupWeights() — the three group partitions ───────────

    @Test
    @DisplayName("L1-FSP-12 | EP: critical questions only → critical takes 100%")
    void criticalOnlyVersionTakesAllWeight() {
        FormScoringPolicy.GroupWeights weights = policy.effectiveGroupWeights(version(question("C", true)));

        assertThat(weights.critical()).isEqualByComparingTo("100");
        assertThat(weights.normal()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-FSP-13 | EP: normal questions only → normal takes 100%")
    void normalOnlyVersionUsesAllAvailableWeight() {
        FormScoringPolicy.GroupWeights weights = policy.effectiveGroupWeights(
                version(question("N1", false), question("N2", false)));

        assertThat(weights.critical()).isEqualByComparingTo("0");
        assertThat(weights.normal()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("L1-FSP-14 | EP: mixed groups → split is criticalWeightPercent / 100 - it")
    void mixedVersionSplitsByConfiguredShare() {
        FormVersion version = version(question("N", false), question("C", true));
        policy.setCriticalWeightPercent(version, new BigDecimal("70"));

        FormScoringPolicy.GroupWeights weights = policy.effectiveGroupWeights(version);

        assertThat(weights.critical()).isEqualByComparingTo("70");
        assertThat(weights.normal()).isEqualByComparingTo("30");
    }

    // ── Block: ensurePublishDefault() ─────────────────────────────────────────

    @Test
    @DisplayName("L1-FSP-15 | CC-TRUE: unconfigured version with a critical question gets the 60% default")
    void publishDefaultIsPersistedWhenCriticalQuestionExists() {
        FormVersion version = version(question("N", false), question("C", true));

        policy.ensurePublishDefault(version);

        assertThat(policy.hasConfiguredCriticalWeight(version)).isTrue();
        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("60");
    }

    @Test
    @DisplayName("L1-FSP-16 | CC-FALSE: no critical question → nothing written to settings")
    void publishDefaultIsSkippedWithoutCriticalQuestion() {
        FormVersion version = version(question("N1", false), question("N2", false));

        policy.ensurePublishDefault(version);

        assertThat(policy.hasConfiguredCriticalWeight(version)).isFalse();
    }

    @Test
    @DisplayName("L1-FSP-17 | CC-FALSE: already-configured share is not overwritten by the default")
    void publishDefaultDoesNotOverwriteConfiguredShare() {
        FormVersion version = version(question("N", false), question("C", true));
        policy.setCriticalWeightPercent(version, new BigDecimal("25"));

        policy.ensurePublishDefault(version);

        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("25");
    }

    // ── Block: resolve() — passing score modes and weights ────────────────────

    @Test
    @DisplayName("L1-FSP-18 | EP-Valid: passingScoreOverride → CUSTOM mode, raw floor = max * override / 10")
    void customPassingScoreIsReturnedOnTenPointScale() {
        FormVersion version = version(question("N1", false), question("N2", false));
        version.setPassingScoreOverride(new BigDecimal("7.5"));

        FormScoringPolicy.Definition definition = policy.resolve(version);

        assertThat(definition.passingScoreMode()).isEqualTo(PassingScoreMode.CUSTOM);
        assertThat(definition.effectivePassingScore()).isEqualByComparingTo("7.5");
        assertThat(definition.rawPassingScore()).isEqualByComparingTo("0.75");
    }

    @Test
    @DisplayName("L1-FSP-19 | EP-Valid: no override → DEFAULT mode, raw floor = sum of weights")
    void defaultPassingScoreUsesLegacyWeightFloor() {
        FormVersion version = version(question("N1", false), question("N2", false));

        FormScoringPolicy.Definition definition = policy.resolve(version);

        assertThat(definition.passingScoreMode()).isEqualTo(PassingScoreMode.DEFAULT);
        // Two equally weighted questions → weights 0.5 + 0.5 = 1.0 raw floor.
        assertThat(definition.rawPassingScore()).isEqualByComparingTo("1");
        assertThat(definition.legacyRawPassingScore()).isEqualByComparingTo("1");
        assertThat(definition.effectivePassingScore()).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("L1-FSP-20 | CC-TRUE: single group (normal only) → weight is coefficient / total coefficient")
    void singleGroupUsesPlainCoefficientShare() {
        FormQuestion heavy = question("HEAVY", false);
        heavy.setWeight(new BigDecimal("3"));
        FormQuestion light = question("LIGHT", false);
        light.setWeight(BigDecimal.ONE);

        FormScoringPolicy.Definition definition = policy.resolve(version(heavy, light));

        assertThat(definition.questions()).hasSize(2);
        assertThat(definition.questions().get(0).weight()).isEqualByComparingTo("0.75");
        assertThat(definition.questions().get(1).weight()).isEqualByComparingTo("0.25");
    }

    @ParameterizedTest(name = "weight={0}")
    @CsvSource({"0", "-1"})
    @DisplayName("L1-FSP-21 | EP-Invalid: coefficient <= 0 falls back to 1 (equal share)")
    void nonPositiveCoefficientFallsBackToOne(BigDecimal weight) {
        FormQuestion first = question("FIRST", false);
        first.setWeight(weight);
        FormQuestion second = question("SECOND", false);
        second.setWeight(BigDecimal.ONE);

        FormScoringPolicy.Definition definition = policy.resolve(version(first, second));

        assertThat(definition.questions().get(0).weight()).isEqualByComparingTo("0.5");
        assertThat(definition.questions().get(1).weight()).isEqualByComparingTo("0.5");
    }

    @Test
    @DisplayName("L1-FSP-22 | EP-Invalid: null coefficient falls back to 1")
    void nullCoefficientFallsBackToOne() {
        FormQuestion first = question("FIRST", false);
        first.setWeight(null);
        FormQuestion second = question("SECOND", false);
        second.setWeight(null);

        FormScoringPolicy.Definition definition = policy.resolve(version(first, second));

        assertThat(definition.questions().get(0).weight()).isEqualByComparingTo("0.5");
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private FormVersion version(FormQuestion... questions) {
        FormVersion version = FormVersion.builder().settingsJson(new LinkedHashMap<>()).build();
        FormSection section = FormSection.builder().formVersion(version).displayOrder(0).build();
        section.getQuestions().addAll(List.of(questions));
        Arrays.stream(questions).forEach(question -> {
            question.setFormVersion(version);
            question.setSection(section);
        });
        version.getSections().add(section);
        return version;
    }

    private FormQuestion bareQuestion(String code, boolean critical) {
        return FormQuestion.builder()
                .questionKey(UUID.randomUUID())
                .code(code)
                .title(code)
                .itemType(FormItemType.QUESTION)
                .fieldType(FormFieldType.SINGLE_CHOICE)
                .critical(critical)
                .excludeFromScore(false)
                .build();
    }

    private FormQuestion question(String code, boolean critical) {
        FormQuestion question = bareQuestion(code, critical);
        question.getOptions().addAll(List.of(option(question, "1"), option(question, "0")));
        return question;
    }

    private FormOption option(FormQuestion question, String scoreValue) {
        return FormOption.builder()
                .question(question)
                .scoreValue(scoreValue == null ? null : new BigDecimal(scoreValue))
                .build();
    }
}
