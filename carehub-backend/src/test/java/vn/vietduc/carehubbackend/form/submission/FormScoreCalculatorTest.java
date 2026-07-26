package vn.vietduc.carehubbackend.form.submission;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.*;
import vn.vietduc.carehubbackend.form.scoring.FormScoringPolicy;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.form.submission.service.FormScoreCalculator;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * L1 unit tests — sheet {@code FormScoreCalculator}, Test ID prefix {@code L1-FSC}.
 * Uses a real {@link FormScoringPolicy} because the weight normalisation is part of the
 * behaviour under test; there is nothing external to mock.
 */
class FormScoreCalculatorTest {
    private final FormScoreCalculator calculator = new FormScoreCalculator(new FormScoringPolicy());

    // ── Block: calculate() — not-configured short circuit ─────────────────────

    @Test
    @DisplayName("L1-FSC-01 | BC-TRUE: unscorable version → NOT_CONFIGURED with a null result")
    void missingScoreConfigurationReturnsNotConfigured() {
        FormOption unscored = FormOption.builder()
                .id(11L).optionKey(UUID.randomUUID()).value("UNKNOWN").label("Unknown").active(true).build();
        FormQuestion question = question(1L, "Q", false, unscored);

        FormScoreCalculator.ScoreResult result = calculator.calculate(
                version(question), List.of(answer(question, unscored)));

        assertThat(result.scoringStatus()).isEqualTo(FormScoringStatus.NOT_CONFIGURED);
        assertThat(result.result()).isNull();
        assertThat(result.breakdown()).isEmpty();
    }

    // ── Block: calculate() — missing answer partitions ────────────────────────

    @Test
    @DisplayName("L1-FSC-02 | CC-TRUE: question with no answer at all scores 0 (first sub-condition)")
    void unansweredQuestionScoresZero() {
        FormQuestion answered = question(1L, "A", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion unanswered = question(2L, "B", false, option(21L, "YES", "1"), option(22L, "NO", "0"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(
                version(answered, unanswered),
                List.of(answer(answered, answered.getOptions().get(0))));

        assertThat(result.totalScore()).isEqualByComparingTo("0.5");
        assertThat(result.breakdown().get(1).baseScore()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("L1-FSC-03 | CC-TRUE: answer present but selectedOption null scores 0 (second sub-condition)")
    void answerWithoutSelectedOptionScoresZero() {
        FormQuestion first = question(1L, "A", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion second = question(2L, "B", false, option(21L, "YES", "1"), option(22L, "NO", "0"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(
                version(first, second),
                List.of(answer(first, first.getOptions().get(0)), answer(second, null)));

        assertThat(result.totalScore()).isEqualByComparingTo("0.5");
        assertThat(result.breakdown().get(1).baseScore()).isEqualByComparingTo("0");
    }

    // ── Block: calculate() — critical failure guard ────────────────────────────

    @Test
    @DisplayName("L1-FSC-04 | Guard-TRUE: critical question scored 0 → FAILED_CRITICAL")
    void criticalQuestionScoredZeroFailsCritically() {
        FormQuestion hand = question(1L, "HAND", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion critical = question(2L, "CRITICAL", true,
                option(21L, "NOT_ACHIEVED", "0"), option(22L, "ACHIEVED", "1"), option(23L, "EXCELLENT", "1.5"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(hand, critical), List.of(
                answer(hand, hand.getOptions().get(0)),
                answer(critical, critical.getOptions().get(0))));

        assertThat(result.result()).isEqualTo(FormSubmissionResult.FAILED_CRITICAL);
        assertThat(result.criticalFailure()).isTrue();
        assertThat(result.totalScore()).isEqualByComparingTo("0.40");
    }

    @Test
    @DisplayName("L1-FSC-05 | Guard-FALSE: critical question scored above 0 → no critical failure")
    void criticalQuestionScoredAboveZeroDoesNotFailCritically() {
        FormQuestion normal = question(1L, "NORMAL", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion critical = question(2L, "CRITICAL", true, option(21L, "NO", "0"), option(22L, "YES", "1"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(normal, critical), List.of(
                answer(normal, normal.getOptions().get(0)),
                answer(critical, critical.getOptions().get(1))));

        assertThat(result.criticalFailure()).isFalse();
        assertThat(result.result()).isEqualTo(FormSubmissionResult.PASSED);
    }

    @Test
    @DisplayName("L1-FSC-06 | CC-FALSE: non-critical question scored 0 is not a critical failure")
    void nonCriticalZeroIsNotACriticalFailure() {
        FormQuestion first = question(1L, "A", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion second = question(2L, "B", false, option(21L, "YES", "1"), option(22L, "NO", "0"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(first, second), List.of(
                answer(first, first.getOptions().get(0)),
                answer(second, second.getOptions().get(1))));

        assertThat(result.criticalFailure()).isFalse();
        assertThat(result.result()).isEqualTo(FormSubmissionResult.FAILED_SCORE);
    }

    // ── Block: calculate() — PASSED / FAILED_SCORE boundary ───────────────────

    @Test
    @DisplayName("L1-FSC-07 | BVA-Min: total exactly equals rawPassingScore → PASSED")
    void totalExactlyOnThePassingFloorPasses() {
        FormVersion version = twoEqualQuestionsWithOverride("5"); // rawPassingScore = 1.0 * 0.5 = 0.5
        List<FormQuestion> questions = scoredQuestions(version);

        FormScoreCalculator.ScoreResult result = calculator.calculate(version, List.of(
                answer(questions.get(0), questions.get(0).getOptions().get(0)),  // 1
                answer(questions.get(1), questions.get(1).getOptions().get(1)))); // 0

        assertThat(result.passingScore()).isEqualByComparingTo("0.5");
        assertThat(result.totalScore()).isEqualByComparingTo("0.5");
        assertThat(result.result()).isEqualTo(FormSubmissionResult.PASSED);
    }

    @Test
    @DisplayName("L1-FSC-08 | BVA-Min-1: total just below rawPassingScore → FAILED_SCORE")
    void totalBelowThePassingFloorFails() {
        FormVersion version = twoEqualQuestionsWithOverride("5");
        List<FormQuestion> questions = scoredQuestions(version);

        FormScoreCalculator.ScoreResult result = calculator.calculate(version, List.of(
                answer(questions.get(0), questions.get(0).getOptions().get(1)),  // 0
                answer(questions.get(1), questions.get(1).getOptions().get(1)))); // 0

        assertThat(result.totalScore()).isEqualByComparingTo("0");
        assertThat(result.result()).isEqualTo(FormSubmissionResult.FAILED_SCORE);
    }

    @Test
    @DisplayName("L1-FSC-09 | EP-Valid: custom override 7.5 sets the raw floor to 0.75 of the max")
    void customPassingScoreUsesConvertedTenPointScale() {
        FormVersion version = twoEqualQuestionsWithOverride("7.5");
        List<FormQuestion> questions = scoredQuestions(version);

        FormScoreCalculator.ScoreResult failed = calculator.calculate(version, List.of(
                answer(questions.get(0), questions.get(0).getOptions().get(0)),
                answer(questions.get(1), questions.get(1).getOptions().get(1))));
        FormScoreCalculator.ScoreResult passed = calculator.calculate(version, List.of(
                answer(questions.get(0), questions.get(0).getOptions().get(0)),
                answer(questions.get(1), questions.get(1).getOptions().get(0))));

        assertThat(failed.passingScore()).isEqualByComparingTo("0.75");
        assertThat(failed.result()).isEqualTo(FormSubmissionResult.FAILED_SCORE);
        assertThat(passed.result()).isEqualTo(FormSubmissionResult.PASSED);
    }

    // ── Block: calculate() — converted score, breakdown, answer mutation ──────

    @Test
    @DisplayName("L1-FSC-10 | BVA-Max: full marks → converted score is exactly 10")
    void fullMarksConvertToTen() {
        FormQuestion hand = question(1L, "HAND", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion quality = question(2L, "QUALITY", false,
                option(21L, "ACHIEVED", "1"), option(22L, "EXCELLENT", "1.5"));
        FormQuestion note = FormQuestion.builder()
                .id(3L).questionKey(UUID.randomUUID()).code("NOTE").title("Ghi chú")
                .itemType(FormItemType.QUESTION).fieldType(FormFieldType.LONG_TEXT)
                .excludeFromScore(true).build();

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(hand, quality, note), List.of(
                answer(hand, hand.getOptions().get(0)),
                answer(quality, quality.getOptions().get(1))));

        assertThat(result.result()).isEqualTo(FormSubmissionResult.PASSED);
        assertThat(result.totalScore()).isEqualByComparingTo("1.25");
        assertThat(result.convertedScore()).isEqualByComparingTo("10");
        assertThat(result.passingScore()).isEqualByComparingTo("1");
        // The excluded LONG_TEXT item must not appear in the breakdown.
        assertThat(result.breakdown()).hasSize(2);
    }

    @Test
    @DisplayName("L1-FSC-11 | State: the FormAnswer entity is stamped with score, weight and weighted score")
    void answerEntityIsStampedWithScoringFields() {
        FormQuestion normal = question(1L, "NORMAL", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion critical = question(2L, "CRITICAL", true, option(21L, "YES", "1"), option(22L, "NO", "0"));
        FormAnswer criticalAnswer = answer(critical, critical.getOptions().get(0));

        calculator.calculate(version(normal, critical), List.of(
                answer(normal, normal.getOptions().get(0)), criticalAnswer));

        // Default critical share is 60%, and there is a single critical question.
        assertThat(criticalAnswer.getScoreValue()).isEqualByComparingTo("1");
        assertThat(display(criticalAnswer.getWeight())).isEqualTo("0.6000");
        assertThat(display(criticalAnswer.getWeightedScore())).isEqualTo("0.6000");
    }

    @Test
    @DisplayName("L1-FSC-12 | EP-Valid: breakdown rows carry question metadata and per-question max")
    void breakdownCarriesQuestionMetadata() {
        FormQuestion important = question(1L, "IMPORTANT", false,
                option(11L, "ACHIEVED", "1"), option(12L, "EXCELLENT", "1.5"));
        important.setWeight(new BigDecimal("5"));
        FormQuestion normal = question(2L, "NORMAL", false,
                option(21L, "ACHIEVED", "1"), option(22L, "EXCELLENT", "1.5"));
        normal.setWeight(BigDecimal.ONE);

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(important, normal), List.of(
                answer(important, important.getOptions().get(0)),
                answer(normal, normal.getOptions().get(0))));

        assertThat(result.breakdown()).extracting(FormScoreCalculator.Breakdown::code)
                .containsExactly("IMPORTANT", "NORMAL");
        assertThat(result.breakdown().get(0).critical()).isFalse();
        assertThat(display(result.breakdown().get(0).weight())).isEqualTo("0.8333");
        assertThat(display(result.breakdown().get(1).weight())).isEqualTo("0.1667");
        assertThat(display(result.breakdown().get(0).maxScore())).isEqualTo("1.2500");
        assertThat(display(result.breakdown().get(1).maxScore())).isEqualTo("0.2500");
    }

    @Test
    @DisplayName("L1-FSC-13 | EP-Valid: no critical questions → equal weights, default floor requires full marks")
    void noCriticalQuestionsHaveEqualWeight() {
        FormQuestion first = question(1L, "A", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion second = question(2L, "B", false, option(21L, "YES", "1"), option(22L, "NO", "0"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(first, second), List.of(
                answer(first, first.getOptions().get(0)),
                answer(second, second.getOptions().get(0))));

        assertThat(display(result.breakdown().get(0).weight())).isEqualTo("0.5000");
        assertThat(display(result.breakdown().get(1).weight())).isEqualTo("0.5000");
        assertThat(result.result()).isEqualTo(FormSubmissionResult.PASSED);
    }

    @Test
    @DisplayName("L1-FSC-14 | EP-Valid: mixed groups use the default 60/40 critical share")
    void missingCriticalShareDefaultsToSixtyPercent() {
        FormQuestion normal = question(1L, "NORMAL", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion critical = question(2L, "CRITICAL", true, option(21L, "YES", "1"), option(22L, "NO", "0"));

        FormScoreCalculator.ScoreResult result = calculator.calculate(version(normal, critical), List.of(
                answer(normal, normal.getOptions().get(0)),
                answer(critical, critical.getOptions().get(0))));

        assertThat(display(result.breakdown().get(0).weight())).isEqualTo("0.4000");
        assertThat(display(result.breakdown().get(1).weight())).isEqualTo("0.6000");
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private FormVersion twoEqualQuestionsWithOverride(String override) {
        FormQuestion first = question(1L, "A", false, option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion second = question(2L, "B", false, option(21L, "YES", "1"), option(22L, "NO", "0"));
        FormVersion version = version(first, second);
        version.setPassingScoreOverride(new BigDecimal(override));
        return version;
    }

    private List<FormQuestion> scoredQuestions(FormVersion version) {
        return version.getSections().get(0).getQuestions().stream().toList();
    }

    private FormVersion version(FormQuestion... questions) {
        FormVersion version = FormVersion.builder().settingsJson(Map.of()).build();
        FormSection section = FormSection.builder().formVersion(version).displayOrder(0).build();
        section.getQuestions().addAll(List.of(questions));
        Arrays.stream(questions).forEach(question -> {
            question.setFormVersion(version);
            question.setSection(section);
        });
        version.getSections().add(section);
        return version;
    }

    private FormQuestion question(Long id, String code, boolean critical, FormOption... options) {
        FormQuestion question = FormQuestion.builder()
                .id(id).questionKey(UUID.randomUUID()).code(code).title(code)
                .itemType(FormItemType.QUESTION).fieldType(FormFieldType.SINGLE_CHOICE)
                .critical(critical).excludeFromScore(false).build();
        question.getOptions().addAll(List.of(options));
        Arrays.stream(options).forEach(option -> option.setQuestion(question));
        return question;
    }

    private FormOption option(Long id, String value, String score) {
        return FormOption.builder()
                .id(id).optionKey(UUID.randomUUID()).value(value).label(value)
                .scoreValue(new BigDecimal(score)).active(true).build();
    }

    private FormAnswer answer(FormQuestion question, FormOption option) {
        return FormAnswer.builder().question(question).selectedOption(option).answerJson(Map.of()).build();
    }

    private String display(BigDecimal value) {
        return value.setScale(4, RoundingMode.HALF_UP).toPlainString();
    }
}
