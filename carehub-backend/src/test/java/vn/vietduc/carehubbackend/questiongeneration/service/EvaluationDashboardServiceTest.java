package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.QuestionItemAnalysisProjection;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EvaluationDashboardServiceTest {
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final ExamAttemptRepository attemptRepository = mock(ExamAttemptRepository.class);
    private final ExamAttemptAnswerRepository answerRepository = mock(ExamAttemptAnswerRepository.class);
    private EvaluationDashboardService service;

    @BeforeEach
    void setUp() {
        service = new EvaluationDashboardService(questionRepository, attemptRepository, answerRepository);
        when(questionRepository.count()).thenReturn(10L);
        when(questionRepository.countByStatus(QuestionBankStatus.APPROVED)).thenReturn(6L);
        when(questionRepository.countByStatus(QuestionBankStatus.DRAFT)).thenReturn(2L);
        when(questionRepository.countByStatus(QuestionBankStatus.REJECTED)).thenReturn(1L);
        when(questionRepository.countByStatus(QuestionBankStatus.ARCHIVED)).thenReturn(1L);
        when(questionRepository.countByQuestionType(QuestionType.ORIGINAL)).thenReturn(8L);
        when(questionRepository.countByQuestionType(QuestionType.PARAPHRASE)).thenReturn(2L);
        when(questionRepository.countGroupByStatus()).thenReturn(List.of(new CountRow("APPROVED", 6L)));
        when(questionRepository.countGroupByDifficulty()).thenReturn(List.of(new CountRow("easy", 4L)));
        when(questionRepository.countGroupByTopic()).thenReturn(List.of(new CountRow("An toàn", 5L)));
        when(questionRepository.countGroupBySourceDocument()).thenReturn(List.of(new CountRow("file.pdf", 3L)));
        when(attemptRepository.countByStatus(ExamAttemptStatus.IN_PROGRESS)).thenReturn(1L);
        when(attemptRepository.countByStatus(ExamAttemptStatus.EXPIRED)).thenReturn(1L);
        when(attemptRepository.countGroupByStatus()).thenReturn(List.of(new CountRow("GRADED", 2L)));
        when(answerRepository.analyzeQuestionItems(List.of(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED))).thenReturn(List.of(
                new ItemRow(101L, "Câu hỏi A", "An toàn", "easy", 4L, 3L)
        ));
    }

    @Test
    void questionBankSummaryCountsStatusAndType() {
        var summary = service.questionBankSummary();

        assertThat(summary.totalQuestions()).isEqualTo(10);
        assertThat(summary.approvedQuestions()).isEqualTo(6);
        assertThat(summary.originalQuestions()).isEqualTo(8);
        assertThat(summary.byTopic()).extracting("label").containsExactly("An toàn");
    }

    @Test
    void examResultsSummaryCalculatesAverageAndPassRate() {
        when(attemptRepository.findAllByOrderByStartedAtDesc()).thenReturn(List.of(
                attempt(ExamAttemptStatus.GRADED, "80.00", true, 120),
                attempt(ExamAttemptStatus.GRADED, "40.00", false, 180),
                attempt(ExamAttemptStatus.IN_PROGRESS, null, null, null)
        ));

        var summary = service.examResultsSummary();

        assertThat(summary.totalAttempts()).isEqualTo(3);
        assertThat(summary.gradedAttempts()).isEqualTo(2);
        assertThat(summary.averageScore()).isEqualByComparingTo("60.00");
        assertThat(summary.passRate()).isEqualTo(0.5);
        assertThat(summary.averageTimeSpentSeconds()).isEqualTo(150);
    }

    @Test
    void itemAnalysisCalculatesCorrectRate() {
        var rows = service.itemAnalysis();

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).questionId()).isEqualTo(101L);
        assertThat(rows.get(0).wrongCount()).isEqualTo(1);
        assertThat(rows.get(0).correctRate()).isEqualTo(0.75);
    }

    private ExamAttempt attempt(ExamAttemptStatus status, String score, Boolean passed, Integer timeSpentSeconds) {
        return ExamAttempt.builder()
                .status(status)
                .score(score == null ? null : new BigDecimal(score))
                .passed(passed)
                .timeSpentSeconds(timeSpentSeconds)
                .build();
    }

    private record CountRow(String key, Long count) implements CountByKeyProjection {
        @Override
        public String getKey() {
            return key;
        }

        @Override
        public Long getCount() {
            return count;
        }
    }

    private record ItemRow(
            Long questionId,
            String stem,
            String topic,
            String difficulty,
            Long attemptCount,
            Long correctCount
    ) implements QuestionItemAnalysisProjection {
        @Override
        public Long getQuestionId() {
            return questionId;
        }

        @Override
        public String getStem() {
            return stem;
        }

        @Override
        public String getTopic() {
            return topic;
        }

        @Override
        public String getDifficulty() {
            return difficulty;
        }

        @Override
        public Long getAttemptCount() {
            return attemptCount;
        }

        @Override
        public Long getCorrectCount() {
            return correctCount;
        }
    }
}
