package vn.vietduc.carehubbackend.form.scoring;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.*;

import java.math.BigDecimal;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;

class FormScoringPolicyTest {
    private final FormScoringPolicy policy = new FormScoringPolicy();

    @Test
    void defaultsToSixtyAndPersistsDefaultBeforePublication() {
        FormVersion version = version(question(false), question(true));

        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("60");
        assertThat(policy.hasConfiguredCriticalWeight(version)).isFalse();

        policy.ensurePublishDefault(version);

        assertThat(policy.hasConfiguredCriticalWeight(version)).isTrue();
        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("60");
    }

    @Test
    void acceptsZeroAndOneHundredPercentBoundaries() {
        FormVersion version = version(question(false), question(true));

        policy.setCriticalWeightPercent(version, BigDecimal.ZERO);
        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("0");

        policy.setCriticalWeightPercent(version, new BigDecimal("100"));
        assertThat(policy.criticalWeightPercent(version)).isEqualByComparingTo("100");
    }

    @Test
    void customPassingScoreIsReturnedOnTenPointScale() {
        FormVersion version = version(question(false), question(false));
        version.setPassingScoreOverride(new BigDecimal("7.5"));

        FormScoringPolicy.Definition definition = policy.resolve(version);

        assertThat(definition.effectivePassingScore()).isEqualByComparingTo("7.5");
        assertThat(definition.rawPassingScore()).isEqualByComparingTo("0.75");
    }

    @Test
    void normalOnlyVersionUsesAllAvailableWeight() {
        FormVersion version = version(question(false), question(false));

        FormScoringPolicy.GroupWeights weights = policy.effectiveGroupWeights(version);

        assertThat(weights.critical()).isEqualByComparingTo("0");
        assertThat(weights.normal()).isEqualByComparingTo("100");
    }

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

    private FormQuestion question(boolean critical) {
        FormQuestion question = FormQuestion.builder()
                .questionKey(UUID.randomUUID())
                .code(UUID.randomUUID().toString())
                .title("Question")
                .itemType(FormItemType.QUESTION)
                .fieldType(FormFieldType.SINGLE_CHOICE)
                .critical(critical)
                .excludeFromScore(false)
                .build();
        FormOption yes = FormOption.builder().question(question).scoreValue(BigDecimal.ONE).build();
        FormOption no = FormOption.builder().question(question).scoreValue(BigDecimal.ZERO).build();
        question.getOptions().addAll(List.of(yes, no));
        return question;
    }
}
