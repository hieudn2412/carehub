package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCellResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCognitiveResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCellResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCognitiveResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamAttemptResultAggregationServiceTest {
    private final ExamAttemptFieldResultRepository fieldResults = mock(ExamAttemptFieldResultRepository.class);
    private final ExamAttemptCognitiveResultRepository cognitiveResults = mock(ExamAttemptCognitiveResultRepository.class);
    private final ExamAttemptCellResultRepository cellResults = mock(ExamAttemptCellResultRepository.class);
    private final ExamBlueprintFieldRepository blueprintFields = mock(ExamBlueprintFieldRepository.class);
    private final ExamAttemptResultAggregationService service = new ExamAttemptResultAggregationService(
            fieldResults, cognitiveResults, cellResults, blueprintFields);

    @Test
    void aggregatesFieldCognitiveAndCellFromSnapshotsAndUsesFieldThreshold() {
        ExamConfig config = ExamConfig.builder().id(10L).build();
        ExamPaper paper = ExamPaper.builder().id(20L).examConfig(config).passingScore(6).build();
        ExamAttempt attempt = ExamAttempt.builder().id(30L).examPaper(paper).build();
        ProfessionalField criticalCare = ProfessionalField.builder().id(101L).code("CC").name("Hồi sức").build();
        when(blueprintFields.findByExamConfigIdOrderByDisplayOrderAsc(10L)).thenReturn(List.of(
                ExamBlueprintField.builder().professionalField(criticalCare).passingThreshold(new BigDecimal("7.00")).build()
        ));

        ExamPaperQuestion first = question(1L);
        ExamPaperQuestion second = question(2L);
        ExamPaperQuestion third = question(3L);
        Map<Long, ExamPaperQuestionSnapshot> snapshots = Map.of(
                1L, snapshot(first, 101L, "CC", "Hồi sức", CognitiveLevel.FOUNDATION),
                2L, snapshot(second, 101L, "CC", "Hồi sức", CognitiveLevel.FOUNDATION),
                3L, snapshot(third, 202L, "NK", "Ngoại khoa", CognitiveLevel.CLINICAL_APPLICATION)
        );
        Map<Long, ExamAttemptAnswer> answers = new LinkedHashMap<>();
        answers.put(1L, answer(true));
        answers.put(2L, answer(false));
        answers.put(3L, answer(true));

        service.rebuildFromGrade(attempt, List.of(first, second, third), snapshots, answers);
        service.rebuildFromGrade(attempt, List.of(first, second, third), snapshots, answers);

        ArgumentCaptor<ExamAttemptFieldResult> fieldCaptor = ArgumentCaptor.forClass(ExamAttemptFieldResult.class);
        verify(fieldResults, times(4)).save(fieldCaptor.capture());
        assertThat(fieldCaptor.getAllValues()).anySatisfy(result -> {
            assertThat(result.getProfessionalFieldName()).isEqualTo("Hồi sức");
            assertThat(result.getCorrectCount()).isEqualTo(1);
            assertThat(result.getTotalQuestions()).isEqualTo(2);
            assertThat(result.getScore()).isEqualByComparingTo("5.00");
            assertThat(result.getPassingThreshold()).isEqualByComparingTo("7.00");
            assertThat(result.getPassed()).isFalse();
        }).anySatisfy(result -> {
            assertThat(result.getProfessionalFieldName()).isEqualTo("Ngoại khoa");
            assertThat(result.getPassingThreshold()).isEqualByComparingTo("6.00");
            assertThat(result.getPassed()).isTrue();
        });

        ArgumentCaptor<ExamAttemptCognitiveResult> cognitiveCaptor = ArgumentCaptor.forClass(ExamAttemptCognitiveResult.class);
        verify(cognitiveResults, times(4)).save(cognitiveCaptor.capture());
        assertThat(cognitiveCaptor.getAllValues()).anySatisfy(result -> {
            assertThat(result.getCognitiveLevel()).isEqualTo(CognitiveLevel.FOUNDATION);
            assertThat(result.getCorrectCount()).isEqualTo(1);
            assertThat(result.getTotalQuestions()).isEqualTo(2);
        });

        ArgumentCaptor<ExamAttemptCellResult> cellCaptor = ArgumentCaptor.forClass(ExamAttemptCellResult.class);
        verify(cellResults, times(4)).save(cellCaptor.capture());
        assertThat(cellCaptor.getAllValues()).anySatisfy(result -> {
            assertThat(result.getProfessionalFieldName()).isEqualTo("Ngoại khoa");
            assertThat(result.getSmallSample()).isTrue();
        });
        verify(fieldResults, times(2)).deleteByAttempt(attempt);
        verify(cognitiveResults, times(2)).deleteByAttempt(attempt);
        verify(cellResults, times(2)).deleteByAttempt(attempt);
    }

    private ExamPaperQuestion question(Long id) { return ExamPaperQuestion.builder().id(id).build(); }

    private ExamPaperQuestionSnapshot snapshot(ExamPaperQuestion question, Long fieldId, String code, String field, CognitiveLevel cognitive) {
        return ExamPaperQuestionSnapshot.builder().examPaperQuestion(question).professionalFieldId(fieldId)
                .professionalFieldCode(code).professionalFieldName(field).cognitiveLevel(cognitive.name())
                .cognitiveLabel(QuestionGenerationLabels.cognitiveLevel(cognitive)).build();
    }

    private ExamAttemptAnswer answer(boolean correct) { return ExamAttemptAnswer.builder().correct(correct).build(); }
}
