package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.QuestionItemAnalysisProjection;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EvaluationDashboardServiceTest {
    private final QuestionBankQuestionRepository questionRepository = mock(QuestionBankQuestionRepository.class);
    private final ExamAttemptRepository attemptRepository = mock(ExamAttemptRepository.class);
    private final ExamAttemptAnswerRepository answerRepository = mock(ExamAttemptAnswerRepository.class);
    private final ExamPaperQuestionSnapshotRepository snapshotRepository = mock(ExamPaperQuestionSnapshotRepository.class);
    private final ExamAssignmentTargetRepository assignmentTargetRepository = mock(ExamAssignmentTargetRepository.class);
    private EvaluationDashboardService service;

    @BeforeEach
    void setUp() {
        service = new EvaluationDashboardService(
                questionRepository,
                attemptRepository,
                answerRepository,
                snapshotRepository,
                assignmentTargetRepository
        );
        when(questionRepository.count()).thenReturn(10L);
        when(questionRepository.countByStatus(QuestionBankStatus.APPROVED)).thenReturn(6L);
        when(questionRepository.countByStatus(QuestionBankStatus.DRAFT)).thenReturn(2L);
        when(questionRepository.countByStatus(QuestionBankStatus.REJECTED)).thenReturn(1L);
        when(questionRepository.countByStatus(QuestionBankStatus.ARCHIVED)).thenReturn(1L);
        when(questionRepository.countByQuestionType(QuestionType.ORIGINAL)).thenReturn(8L);
        when(questionRepository.countByQuestionType(QuestionType.PARAPHRASE)).thenReturn(2L);
        when(questionRepository.countGroupByStatus()).thenReturn(List.of(new CountRow("APPROVED", 6L)));
        when(questionRepository.countGroupByCognitiveLevel()).thenReturn(List.of(new CountRow("FOUNDATION", 4L)));
        when(questionRepository.countGroupByCategory()).thenReturn(List.of(new CountRow("An toàn", 5L)));
        when(questionRepository.countGroupBySourceDocument()).thenReturn(List.of(new CountRow("file.pdf", 3L)));
        when(attemptRepository.countByStatus(ExamAttemptStatus.IN_PROGRESS)).thenReturn(1L);
        when(attemptRepository.countByStatus(ExamAttemptStatus.EXPIRED)).thenReturn(1L);
        when(attemptRepository.countGroupByStatus()).thenReturn(List.of(new CountRow("GRADED", 2L)));
        when(answerRepository.analyzeQuestionItems(List.of(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED))).thenReturn(List.of(
                new ItemRow(101L, "Câu hỏi A", "An toàn", CognitiveLevel.FOUNDATION, 4L, 3L)
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

    @Test
    void examOverviewIncludesTargetsWithoutAttemptsAndPaperBreakdown() {
        Department department = Department.builder().id(10L).name("Khoa A").build();
        ProfessionalField field = ProfessionalField.builder().id(20L).code("HSCC").name("Hồi sức").build();
        ExamPaper paper = ExamPaper.builder()
                .id(30L)
                .code("P-01")
                .name("Bài kiểm tra A")
                .version(1)
                .totalQuestions(20)
                .passingScore(70)
                .build();
        ExamAssignment assignment = ExamAssignment.builder()
                .id(40L)
                .name("Đợt 1")
                .examPaper(paper)
                .professionalField(field)
                .status(ExamAssignmentStatus.OPEN)
                .build();
        User first = user(50L, "NV050", department);
        User second = user(51L, "NV051", department);
        when(assignmentTargetRepository.findAllForDashboard()).thenReturn(List.of(
                ExamAssignmentTarget.builder().id(60L).assignment(assignment).user(first).build(),
                ExamAssignmentTarget.builder().id(61L).assignment(assignment).user(second).build()
        ));
        when(attemptRepository.findAllByOrderByStartedAtDesc()).thenReturn(List.of(
                ExamAttempt.builder()
                        .id(70L)
                        .assignment(assignment)
                        .examPaper(paper)
                        .user(first)
                        .status(ExamAttemptStatus.GRADED)
                        .startedAt(LocalDateTime.of(2026, 7, 1, 8, 0))
                        .score(new BigDecimal("80"))
                        .passed(true)
                        .build()
        ));

        var overview = service.examOverview(null, null, null, null, 10L, null, null, null);

        assertThat(overview.assignmentCount()).isEqualTo(1);
        assertThat(overview.targetCount()).isEqualTo(2);
        assertThat(overview.notStartedCount()).isEqualTo(1);
        assertThat(overview.attempts().gradedAttempts()).isEqualTo(1);
        assertThat(overview.byPaper()).singleElement().satisfies(item -> {
            assertThat(item.paperCode()).isEqualTo("P-01");
            assertThat(item.averageScore()).isEqualByComparingTo("80");
        });
    }

    private ExamAttempt attempt(ExamAttemptStatus status, String score, Boolean passed, Integer timeSpentSeconds) {
        return ExamAttempt.builder()
                .status(status)
                .score(score == null ? null : new BigDecimal(score))
                .passed(passed)
                .timeSpentSeconds(timeSpentSeconds)
                .build();
    }

    private User user(Long id, String employeeCode, Department department) {
        return User.builder()
                .id(id)
                .employeeCode(employeeCode)
                .name("User " + id)
                .password("password")
                .department(department)
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
            CognitiveLevel cognitiveLevel,
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
        public CognitiveLevel getCognitiveLevel() {
            return cognitiveLevel;
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
