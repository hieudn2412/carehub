package vn.vietduc.carehubbackend.form.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.form.entity.FormOption;
import vn.vietduc.carehubbackend.form.entity.FormQuestion;
import vn.vietduc.carehubbackend.form.entity.FormSection;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormFieldType;
import vn.vietduc.carehubbackend.form.entity.enums.FormItemType;

import java.util.UUID;
import java.math.BigDecimal;
import vn.vietduc.carehubbackend.form.scoring.FormScoringPolicy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FormVersionValidatorTest {
    private final FormVersionValidator validator = new FormVersionValidator(new FormScoringPolicy());

    @Test
    void validChoiceQuestionCanBePublished() {
        FormVersion version = validVersion();

        assertThatCode(() -> validator.validatePublishable(version)).doesNotThrowAnyException();
    }

    @Test
    void emptyFormCannotBePublished() {
        FormVersion version = FormVersion.builder().build();

        assertThatThrownBy(() -> validator.validatePublishable(version))
                .isInstanceOf(ValidationException.class)
                .hasMessageContaining("validation failed");
    }

    @Test
    void duplicateQuestionCodesAreRejectedCaseInsensitively() {
        FormVersion version = validVersion();
        FormSection section = version.getSections().get(0);
        FormQuestion duplicateItem = questionItem(section, "risk_level", 1);
        section.getQuestions().add(duplicateItem);

        assertThatThrownBy(() -> validator.validatePublishable(version))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> {
                    ValidationException validation = (ValidationException) error;
                    assertThat(validation.getFieldErrors())
                            .anyMatch(detail -> detail.message().contains("Question code must be unique"));
                });
    }

    @Test
    void configuredWeightOutsideRangeIsRejected() {
        FormVersion version = validVersion();
        new FormScoringPolicy().setCriticalWeightPercent(version, new BigDecimal("101"));

        assertThatThrownBy(() -> validator.validateDraft(version))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> assertThat(((ValidationException) error).getFieldErrors())
                        .anyMatch(detail -> detail.field().equals("settings.scoring.criticalWeightPercent")));
    }

    @Test
    void criticalOnlyVersionCannotBePublished() {
        FormVersion version = validVersion();
        version.getSections().get(0).getQuestions().get(0).setCritical(true);

        assertThatThrownBy(() -> validator.validatePublishable(version))
                .isInstanceOf(ValidationException.class)
                .satisfies(error -> assertThat(((ValidationException) error).getFieldErrors())
                        .anyMatch(detail -> detail.message().contains("only critical questions")));
    }

    private FormVersion validVersion() {
        FormVersion version = FormVersion.builder().title("Safety form").build();
        FormSection section = FormSection.builder()
                .formVersion(version)
                .sectionKey(UUID.randomUUID())
                .title("Assessment")
                .displayOrder(0)
                .build();
        version.getSections().add(section);
        section.getQuestions().add(questionItem(section, "RISK_LEVEL", 0));
        return version;
    }

    private FormQuestion questionItem(FormSection section, String code, int order) {
        FormQuestion question = FormQuestion.builder()
                .section(section)
                .itemKey(UUID.randomUUID())
                .itemType(FormItemType.QUESTION)
                .displayOrder(order)
                .questionKey(UUID.randomUUID())
                .code(code)
                .title("Risk level")
                .fieldType(FormFieldType.SINGLE_CHOICE)
                .build();
        question.getOptions().add(option(question, "LOW", 0));
        question.getOptions().add(option(question, "HIGH", 1));
        return question;
    }

    private FormOption option(FormQuestion question, String value, int order) {
        return FormOption.builder()
                .question(question)
                .optionKey(UUID.randomUUID())
                .value(value)
                .label(value)
                .scoreValue(order == 0 ? BigDecimal.ZERO : BigDecimal.ONE)
                .displayOrder(order)
                .build();
    }
}
