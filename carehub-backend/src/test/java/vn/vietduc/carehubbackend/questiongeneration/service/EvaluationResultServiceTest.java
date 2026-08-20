package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCellResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCognitiveResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCellResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCognitiveResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EvaluationResultServiceTest {
    private final ExamAttemptRepository attempts = mock(ExamAttemptRepository.class);
    private final ExamAttemptFieldResultRepository fields = mock(ExamAttemptFieldResultRepository.class);
    private final ExamAttemptCognitiveResultRepository cognitive = mock(ExamAttemptCognitiveResultRepository.class);
    private final ExamAttemptCellResultRepository cells = mock(ExamAttemptCellResultRepository.class);
    private final EvaluationResultService service = new EvaluationResultService(attempts, fields, cognitive, cells,
            mock(ExamAttemptAnswerRepository.class),
            mock(ExamPaperQuestionRepository.class), mock(ExamPaperQuestionSnapshotRepository.class));

    @Test
    void reportKeepsSnapshotNamesAndAlwaysReturnsCellDenominator() {
        ExamAssignment assignment = ExamAssignment.builder().id(50L).build();
        User user = User.builder().id(7L).employmentStartDate(LocalDate.now().minusMonths(20)).build();
        ExamAttempt attempt = ExamAttempt.builder().id(1L).assignment(assignment).user(user).build();
        when(fields.findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(50L)).thenReturn(List.of(
                ExamAttemptFieldResult.builder().attempt(attempt).professionalFieldId(9L).professionalFieldCode("HSCC")
                        .professionalFieldName("Hồi sức tại thời điểm thi").correctCount(3).totalQuestions(5)
                        .score(new BigDecimal("6.00")).passingThreshold(new BigDecimal("7.00")).passed(false).build()
        ));
        when(cognitive.findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(50L)).thenReturn(List.of(
                ExamAttemptCognitiveResult.builder().attempt(attempt).cognitiveLevel(CognitiveLevel.FOUNDATION)
                        .cognitiveLabel("Kiến thức nền tảng").correctCount(3).totalQuestions(5).score(new BigDecimal("6.00")).build()
        ));
        when(cells.findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(50L)).thenReturn(List.of(
                ExamAttemptCellResult.builder().attempt(attempt).professionalFieldId(9L).professionalFieldCode("HSCC")
                        .professionalFieldName("Hồi sức tại thời điểm thi").cognitiveLevel(CognitiveLevel.FOUNDATION)
                        .cognitiveLabel("Kiến thức nền tảng").correctCount(1).totalQuestions(1).smallSample(true).build()
        ));

        var report = service.report(50L, null, 36, null, LocalDate.now());

        assertThat(report.gradedAttemptCount()).isEqualTo(1);
        assertThat(report.fields()).singleElement().satisfies(field -> {
            assertThat(field.professionalFieldName()).isEqualTo("Hồi sức tại thời điểm thi");
            assertThat(field.averageScore()).isEqualByComparingTo("6.00");
            assertThat(field.passedAttempts()).isZero();
        });
        assertThat(report.cells()).singleElement().satisfies(cell -> {
            assertThat(cell.correctCount()).isEqualTo(1);
            assertThat(cell.totalQuestions()).isEqualTo(1);
            assertThat(cell.smallSample()).isTrue();
        });
    }
}
