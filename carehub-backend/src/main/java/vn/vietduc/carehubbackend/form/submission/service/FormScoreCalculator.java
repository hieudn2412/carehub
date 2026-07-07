package vn.vietduc.carehubbackend.form.submission.service;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;
import vn.vietduc.carehubbackend.form.submission.entity.*;

import java.math.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class FormScoreCalculator {
    private static final MathContext MC = MathContext.DECIMAL128;
    private static final BigDecimal TEN = BigDecimal.TEN;

    public ScoreResult calculate(FormVersion version, List<FormAnswer> answers) {
        List<FormQuestion> scored = version.getSections().stream().flatMap(s -> s.getQuestions().stream())
                .filter(q -> q.getItemType() == FormItemType.QUESTION && !q.isExcludeFromScore()).toList();
        if (scored.isEmpty() || scored.stream().anyMatch(this::notConfigured)) return ScoreResult.notConfigured();

        List<FormQuestion> critical = scored.stream().filter(FormQuestion::isCritical).toList();
        List<FormQuestion> normal = scored.stream().filter(q -> !q.isCritical()).toList();
        BigDecimal criticalShare = criticalShare(version);
        BigDecimal scoredCoefficientTotal = coefficientTotal(scored);
        BigDecimal criticalCoefficientTotal = coefficientTotal(critical);
        BigDecimal normalCoefficientTotal = coefficientTotal(normal);
        Map<Long, FormAnswer> byQuestion = answers.stream().collect(Collectors.toMap(
                answer -> answer.getQuestion().getId(), Function.identity()));
        List<Breakdown> breakdown = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal max = BigDecimal.ZERO;
        BigDecimal floor = BigDecimal.ZERO;
        boolean criticalFailure = false;

        for (FormQuestion question : scored) {
            BigDecimal weight = weight(question, critical, normal, criticalShare,
                    scoredCoefficientTotal, criticalCoefficientTotal, normalCoefficientTotal);
            FormAnswer answer = byQuestion.get(question.getId());
            BigDecimal base = answer == null || answer.getSelectedOption() == null
                    ? BigDecimal.ZERO : answer.getSelectedOption().getScoreValue();
            BigDecimal questionMax = question.getOptions().stream().map(FormOption::getScoreValue)
                    .max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
            BigDecimal weighted = base.multiply(weight, MC);
            total = total.add(weighted, MC);
            max = max.add(questionMax.multiply(weight, MC), MC);
            floor = floor.add(weight, MC);
            if (question.isCritical() && base.compareTo(BigDecimal.ZERO) <= 0) criticalFailure = true;
            if (answer != null) {
                answer.setScoreValue(base);
                answer.setWeight(weight);
                answer.setWeightedScore(weighted);
            }
            breakdown.add(new Breakdown(question.getQuestionKey(), question.getCode(), question.getTitle(),
                    question.isCritical(), base, weight, weighted, questionMax.multiply(weight, MC)));
        }
        if (max.compareTo(BigDecimal.ZERO) <= 0) return ScoreResult.notConfigured();
        BigDecimal converted = total.multiply(TEN, MC).divide(max, MC);
        FormSubmissionResult result = criticalFailure ? FormSubmissionResult.FAILED_CRITICAL
                : total.compareTo(floor) >= 0 ? FormSubmissionResult.PASSED : FormSubmissionResult.FAILED_SCORE;
        return new ScoreResult(FormScoringStatus.CALCULATED, result, total, max, floor,
                converted, criticalFailure, breakdown);
    }

    private boolean notConfigured(FormQuestion question) {
        return question.getOptions().isEmpty()
                || question.getOptions().stream().anyMatch(option -> option.getScoreValue() == null);
    }

    private BigDecimal criticalShare(FormVersion version) {
        Object scoring = version.getSettingsJson() == null ? null : version.getSettingsJson().get("scoring");
        Object value = scoring instanceof Map<?, ?> map ? map.get("criticalWeightPercent") : null;
        try {
            return new BigDecimal(value == null ? "55" : String.valueOf(value)).divide(new BigDecimal("100"), MC);
        } catch (NumberFormatException ex) {
            return new BigDecimal("0.55");
        }
    }

    private BigDecimal weight(FormQuestion question, List<FormQuestion> critical,
                              List<FormQuestion> normal, BigDecimal criticalShare,
                              BigDecimal scoredCoefficientTotal, BigDecimal criticalCoefficientTotal,
                              BigDecimal normalCoefficientTotal) {
        BigDecimal coefficient = coefficient(question);
        if (critical.isEmpty() || normal.isEmpty()) {
            return coefficient.divide(scoredCoefficientTotal, MC);
        }
        return question.isCritical()
                ? criticalShare.multiply(coefficient, MC).divide(criticalCoefficientTotal, MC)
                : BigDecimal.ONE.subtract(criticalShare, MC).multiply(coefficient, MC).divide(normalCoefficientTotal, MC);
    }

    private BigDecimal coefficientTotal(List<FormQuestion> questions) {
        return questions.stream()
                .map(this::coefficient)
                .reduce(BigDecimal.ZERO, (left, right) -> left.add(right, MC));
    }

    private BigDecimal coefficient(FormQuestion question) {
        BigDecimal configured = question.getWeight();
        return configured == null || configured.compareTo(BigDecimal.ZERO) <= 0 ? BigDecimal.ONE : configured;
    }

    public record Breakdown(UUID questionKey, String code, String title, boolean critical,
                            BigDecimal baseScore, BigDecimal weight, BigDecimal weightedScore,
                            BigDecimal maxScore) {}

    public record ScoreResult(FormScoringStatus scoringStatus, FormSubmissionResult result,
                              BigDecimal totalScore, BigDecimal maxScore, BigDecimal passingScore,
                              BigDecimal convertedScore, boolean criticalFailure, List<Breakdown> breakdown) {
        static ScoreResult notConfigured() {
            return new ScoreResult(FormScoringStatus.NOT_CONFIGURED, null, null, null,
                    null, null, false, List.of());
        }
    }
}
