package vn.vietduc.carehubbackend.form.scoring;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.math.*;
import java.util.*;

@Component
public class FormScoringPolicy {
    public static final BigDecimal DEFAULT_CRITICAL_WEIGHT_PERCENT = new BigDecimal("60");
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal TEN = BigDecimal.TEN;
    private static final MathContext MC = MathContext.DECIMAL128;

    public Definition resolve(FormVersion version) {
        List<FormQuestion> questions = scoredQuestions(version);
        if (questions.isEmpty() || questions.stream().anyMatch(this::notConfigured)) {
            return Definition.notConfigured();
        }

        List<FormQuestion> critical = questions.stream().filter(FormQuestion::isCritical).toList();
        List<FormQuestion> normal = questions.stream().filter(q -> !q.isCritical()).toList();
        BigDecimal criticalShare = criticalWeightPercent(version).divide(HUNDRED, MC);
        BigDecimal allTotal = coefficientTotal(questions);
        BigDecimal criticalTotal = coefficientTotal(critical);
        BigDecimal normalTotal = coefficientTotal(normal);
        List<WeightedQuestion> weightedQuestions = new ArrayList<>();
        BigDecimal maxScore = BigDecimal.ZERO;
        BigDecimal legacyRawFloor = BigDecimal.ZERO;

        for (FormQuestion question : questions) {
            BigDecimal weight = weight(question, critical, normal, criticalShare, allTotal, criticalTotal, normalTotal);
            BigDecimal questionMax = question.getOptions().stream()
                    .map(FormOption::getScoreValue)
                    .max(BigDecimal::compareTo)
                    .orElse(BigDecimal.ZERO);
            BigDecimal weightedMax = questionMax.multiply(weight, MC);
            weightedQuestions.add(new WeightedQuestion(question, weight, weightedMax));
            maxScore = maxScore.add(weightedMax, MC);
            legacyRawFloor = legacyRawFloor.add(weight, MC);
        }

        if (maxScore.compareTo(BigDecimal.ZERO) <= 0) return Definition.notConfigured();
        BigDecimal override = version.getPassingScoreOverride();
        BigDecimal rawFloor = override == null
                ? legacyRawFloor
                : maxScore.multiply(override, MC).divide(TEN, MC);
        BigDecimal effectiveFloor = override == null
                ? legacyRawFloor.multiply(TEN, MC).divide(maxScore, MC)
                : override;
        return new Definition(true, weightedQuestions, maxScore, legacyRawFloor, rawFloor, effectiveFloor,
                override == null ? PassingScoreMode.DEFAULT : PassingScoreMode.CUSTOM);
    }

    public List<FormQuestion> scoredQuestions(FormVersion version) {
        return version.getSections().stream().flatMap(section -> section.getQuestions().stream())
                .filter(question -> question.getItemType() == FormItemType.QUESTION && !question.isExcludeFromScore())
                .toList();
    }

    public BigDecimal criticalWeightPercent(FormVersion version) {
        Object scoring = version.getSettingsJson() == null ? null : version.getSettingsJson().get("scoring");
        Object value = scoring instanceof Map<?, ?> map ? map.get("criticalWeightPercent") : null;
        if (value == null) return DEFAULT_CRITICAL_WEIGHT_PERCENT;
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return BigDecimal.valueOf(-1);
        }
    }

    public GroupWeights effectiveGroupWeights(FormVersion version) {
        List<FormQuestion> questions = scoredQuestions(version);
        boolean hasCritical = questions.stream().anyMatch(FormQuestion::isCritical);
        boolean hasNormal = questions.stream().anyMatch(question -> !question.isCritical());
        if (hasCritical && !hasNormal) return new GroupWeights(HUNDRED, BigDecimal.ZERO);
        if (!hasCritical && hasNormal) return new GroupWeights(BigDecimal.ZERO, HUNDRED);
        BigDecimal critical = criticalWeightPercent(version);
        return new GroupWeights(critical, HUNDRED.subtract(critical));
    }

    public boolean hasConfiguredCriticalWeight(FormVersion version) {
        Object scoring = version.getSettingsJson() == null ? null : version.getSettingsJson().get("scoring");
        return scoring instanceof Map<?, ?> map && map.get("criticalWeightPercent") != null;
    }

    public void setCriticalWeightPercent(FormVersion version, BigDecimal value) {
        Map<String, Object> settings = version.getSettingsJson() == null
                ? new LinkedHashMap<>() : new LinkedHashMap<>(version.getSettingsJson());
        Map<String, Object> scoring = settings.get("scoring") instanceof Map<?, ?> existing
                ? copy(existing) : new LinkedHashMap<>();
        scoring.put("criticalWeightPercent", value.stripTrailingZeros());
        settings.put("scoring", scoring);
        version.setSettingsJson(settings);
    }

    public void ensurePublishDefault(FormVersion version) {
        if (!hasConfiguredCriticalWeight(version)
                && scoredQuestions(version).stream().anyMatch(FormQuestion::isCritical)) {
            setCriticalWeightPercent(version, DEFAULT_CRITICAL_WEIGHT_PERCENT);
        }
    }

    private Map<String, Object> copy(Map<?, ?> source) {
        Map<String, Object> copy = new LinkedHashMap<>();
        source.forEach((key, value) -> copy.put(String.valueOf(key), value));
        return copy;
    }

    private boolean notConfigured(FormQuestion question) {
        return question.getOptions().isEmpty()
                || question.getOptions().stream().anyMatch(option -> option.getScoreValue() == null);
    }

    private BigDecimal weight(FormQuestion question, List<FormQuestion> critical, List<FormQuestion> normal,
                              BigDecimal criticalShare, BigDecimal allTotal,
                              BigDecimal criticalTotal, BigDecimal normalTotal) {
        BigDecimal coefficient = coefficient(question);
        if (critical.isEmpty() || normal.isEmpty()) return coefficient.divide(allTotal, MC);
        return question.isCritical()
                ? criticalShare.multiply(coefficient, MC).divide(criticalTotal, MC)
                : BigDecimal.ONE.subtract(criticalShare, MC).multiply(coefficient, MC).divide(normalTotal, MC);
    }

    private BigDecimal coefficientTotal(List<FormQuestion> questions) {
        return questions.stream().map(this::coefficient)
                .reduce(BigDecimal.ZERO, (left, right) -> left.add(right, MC));
    }

    private BigDecimal coefficient(FormQuestion question) {
        BigDecimal configured = question.getWeight();
        return configured == null || configured.compareTo(BigDecimal.ZERO) <= 0 ? BigDecimal.ONE : configured;
    }

    public record WeightedQuestion(FormQuestion question, BigDecimal weight, BigDecimal maxScore) {}

    public record GroupWeights(BigDecimal critical, BigDecimal normal) {}

    public record Definition(boolean configured, List<WeightedQuestion> questions, BigDecimal maxScore,
                             BigDecimal legacyRawPassingScore, BigDecimal rawPassingScore,
                             BigDecimal effectivePassingScore, PassingScoreMode passingScoreMode) {
        static Definition notConfigured() {
            return new Definition(false, List.of(), null, null, null, null, PassingScoreMode.DEFAULT);
        }
    }
}
