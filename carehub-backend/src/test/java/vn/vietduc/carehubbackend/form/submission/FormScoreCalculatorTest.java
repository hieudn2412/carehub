package vn.vietduc.carehubbackend.form.submission;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.*;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.form.submission.service.FormScoreCalculator;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class FormScoreCalculatorTest {
    private final FormScoreCalculator calculator = new FormScoreCalculator();

    @Test
    void binaryHandHygieneUsesOneAndZeroAndCriticalZeroFails() {
        FormQuestion hand = question(1L, "HAND", false,
                option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion critical = question(2L, "CRITICAL", true,
                option(21L, "NOT_ACHIEVED", "0"), option(22L, "ACHIEVED", "1"), option(23L, "EXCELLENT", "1.5"));
        FormVersion version = version(hand, critical);
        List<FormAnswer> answers = List.of(answer(hand, hand.getOptions().get(0)),
                answer(critical, critical.getOptions().get(0)));

        var result = calculator.calculate(version, answers);

        assertEquals(FormSubmissionResult.FAILED_CRITICAL, result.result());
        assertTrue(result.criticalFailure());
        assertEquals(0, new BigDecimal("0.45").compareTo(result.totalScore()));
    }

    @Test
    void noCriticalQuestionsHaveEqualWeightAndCanPass() {
        FormQuestion hand = question(1L, "HAND", false,
                option(11L, "YES", "1"), option(12L, "NO", "0"));
        FormQuestion quality = question(2L, "QUALITY", false,
                option(21L, "ACHIEVED", "1"), option(22L, "EXCELLENT", "1.5"));
        FormQuestion note = FormQuestion.builder().id(3L).questionKey(UUID.randomUUID()).code("NOTE").title("Ghi chú")
                .itemType(FormItemType.QUESTION).fieldType(FormFieldType.LONG_TEXT).excludeFromScore(true).build();
        var result = calculator.calculate(version(hand, quality, note), List.of(
                answer(hand, hand.getOptions().get(0)), answer(quality, quality.getOptions().get(1))));

        assertEquals(FormSubmissionResult.PASSED, result.result());
        assertEquals(0, new BigDecimal("1.25").compareTo(result.totalScore()));
        assertEquals(0, BigDecimal.TEN.compareTo(result.convertedScore()));
        assertEquals(0, BigDecimal.ONE.compareTo(result.passingScore()));
    }

    @Test
    void missingScoreConfigurationReturnsNotConfigured() {
        FormOption option = FormOption.builder().id(11L).value("UNKNOWN").label("Unknown").active(true).build();
        FormQuestion question = question(1L, "Q", false, option);
        var result = calculator.calculate(version(question), List.of(answer(question, option)));
        assertEquals(FormScoringStatus.NOT_CONFIGURED, result.scoringStatus());
        assertNull(result.result());
    }

    private FormVersion version(FormQuestion... questions) {
        FormVersion version = FormVersion.builder().settingsJson(Map.of()).build();
        FormSection section = FormSection.builder().formVersion(version).displayOrder(0).build();
        section.getQuestions().addAll(List.of(questions));
        Arrays.stream(questions).forEach(q -> { q.setFormVersion(version); q.setSection(section); });
        version.getSections().add(section);
        return version;
    }

    private FormQuestion question(Long id, String code, boolean critical, FormOption... options) {
        FormQuestion question = FormQuestion.builder().id(id).questionKey(UUID.randomUUID()).code(code).title(code)
                .itemType(FormItemType.QUESTION).fieldType(FormFieldType.SINGLE_CHOICE)
                .critical(critical).excludeFromScore(false).build();
        question.getOptions().addAll(List.of(options));
        Arrays.stream(options).forEach(o -> o.setQuestion(question));
        return question;
    }

    private FormOption option(Long id, String value, String score) {
        return FormOption.builder().id(id).optionKey(UUID.randomUUID()).value(value).label(value)
                .scoreValue(new BigDecimal(score)).active(true).build();
    }

    private FormAnswer answer(FormQuestion question, FormOption option) {
        return FormAnswer.builder().question(question).selectedOption(option).answerJson(Map.of()).build();
    }
}
