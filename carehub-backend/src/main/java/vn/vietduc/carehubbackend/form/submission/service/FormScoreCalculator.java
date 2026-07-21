package vn.vietduc.carehubbackend.form.submission.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.scoring.FormScoringPolicy;
import vn.vietduc.carehubbackend.form.submission.entity.*;

import java.math.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class FormScoreCalculator {
    private static final MathContext MC = MathContext.DECIMAL128;
    private static final BigDecimal TEN = BigDecimal.TEN;
    private final FormScoringPolicy scoringPolicy;

    public ScoreResult calculate(FormVersion version, List<FormAnswer> answers) {
        FormScoringPolicy.Definition definition = scoringPolicy.resolve(version);
        if (!definition.configured()) return ScoreResult.notConfigured();
        Map<Long, FormAnswer> byQuestion = answers.stream().collect(Collectors.toMap(
                answer -> answer.getQuestion().getId(), Function.identity()));
        List<Breakdown> breakdown = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        boolean criticalFailure = false;

        for (FormScoringPolicy.WeightedQuestion weightedQuestion : definition.questions()) {
            FormQuestion question = weightedQuestion.question();
            BigDecimal weight = weightedQuestion.weight();
            FormAnswer answer = byQuestion.get(question.getId());
            BigDecimal base = answer == null || answer.getSelectedOption() == null
                    ? BigDecimal.ZERO : answer.getSelectedOption().getScoreValue();
            BigDecimal weighted = base.multiply(weight, MC);
            total = total.add(weighted, MC);
            if (question.isCritical() && base.compareTo(BigDecimal.ZERO) <= 0) criticalFailure = true;
            if (answer != null) {
                answer.setScoreValue(base);
                answer.setWeight(weight);
                answer.setWeightedScore(weighted);
            }
            breakdown.add(new Breakdown(question.getQuestionKey(), question.getCode(), question.getTitle(),
                    question.isCritical(), base, weight, weighted, weightedQuestion.maxScore()));
        }
        BigDecimal converted = total.multiply(TEN, MC).divide(definition.maxScore(), MC);
        FormSubmissionResult result = criticalFailure ? FormSubmissionResult.FAILED_CRITICAL
                : total.compareTo(definition.rawPassingScore()) >= 0
                ? FormSubmissionResult.PASSED : FormSubmissionResult.FAILED_SCORE;
        return new ScoreResult(FormScoringStatus.CALCULATED, result, total, definition.maxScore(),
                definition.rawPassingScore(),
                converted, criticalFailure, breakdown);
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
