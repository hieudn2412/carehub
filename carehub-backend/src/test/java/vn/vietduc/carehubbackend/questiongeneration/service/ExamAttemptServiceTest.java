package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.SaveExamAttemptAnswersRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamAttemptServiceTest {
    private final ExamAssignmentService assignmentService = mock(ExamAssignmentService.class);
    private final ExamAttemptRepository attemptRepository = mock(ExamAttemptRepository.class);
    private final ExamAttemptAnswerRepository answerRepository = mock(ExamAttemptAnswerRepository.class);
    private final ExamAssignmentTargetRepository targetRepository = mock(ExamAssignmentTargetRepository.class);
    private final ExamPaperQuestionRepository paperQuestionRepository = mock(ExamPaperQuestionRepository.class);
    private final ExamPaperQuestionSnapshotRepository snapshotRepository = mock(ExamPaperQuestionSnapshotRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CompetencyClassificationService classificationService = mock(CompetencyClassificationService.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final AtomicLong ids = new AtomicLong(500);
    private final List<ExamAttemptAnswer> savedAnswers = new ArrayList<>();
    private ExamAttemptService service;
    private ExamAttempt attempt;
    private ExamPaperQuestion questionOne;
    private ExamPaperQuestion questionTwo;
    private ExamPaperQuestionSnapshot snapshotOne;
    private ExamPaperQuestionSnapshot snapshotTwo;
    private User user;

    @BeforeEach
    void setUp() {
        service = new ExamAttemptService(
                assignmentService,
                attemptRepository,
                answerRepository,
                targetRepository,
                paperQuestionRepository,
                snapshotRepository,
                userRepository,
                classificationService,
                eventPublisher
        );
        user = User.builder()
                .id(10L)
                .employeeCode("NV001")
                .name("Nguyễn Văn A")
                .email("a@example.com")
                .build();
        QuestionSet questionSet = QuestionSet.builder()
                .id(20L)
                .name("Bộ câu hỏi")
                .status(QuestionSetStatus.ACTIVE)
                .build();
        ExamConfig config = ExamConfig.builder()
                .id(30L)
                .name("Cấu hình")
                .questionSet(questionSet)
                .totalQuestions(2)
                .timeLimitMinutes(30)
                .passingScore(60)
                .status(ExamConfigStatus.ACTIVE)
                .build();
        ExamPaper paper = ExamPaper.builder()
                .id(40L)
                .code("EP-1")
                .name("Đề kiểm tra")
                .examConfig(config)
                .questionSet(questionSet)
                .version(1)
                .randomSeed(1L)
                .status(ExamPaperStatus.PUBLISHED)
                .totalQuestions(2)
                .timeLimitMinutes(30)
                .passingScore(60)
                .build();
        ExamAssignment assignment = ExamAssignment.builder()
                .id(50L)
                .name("Phân công")
                .examPaper(paper)
                .status(ExamAssignmentStatus.OPEN)
                .maxAttempts(1)
                .build();
        questionOne = paperQuestion(60L, paper, 1);
        questionTwo = paperQuestion(61L, paper, 2);
        snapshotOne = snapshot(questionOne, "A");
        snapshotTwo = snapshot(questionTwo, "C");
        attempt = ExamAttempt.builder()
                .id(70L)
                .assignment(assignment)
                .examPaper(paper)
                .user(user)
                .attemptNumber(1)
                .status(ExamAttemptStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now().minusMinutes(5))
                .expiresAt(LocalDateTime.now().plusMinutes(25))
                .totalQuestions(2)
                .build();
        savedAnswers.clear();

        when(attemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(attemptRepository.save(any(ExamAttempt.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(answerRepository.save(any(ExamAttemptAnswer.class))).thenAnswer(invocation -> {
            ExamAttemptAnswer answer = invocation.getArgument(0);
            if (answer.getId() == null) {
                answer.setId(ids.incrementAndGet());
                savedAnswers.add(answer);
            }
            return answer;
        });
        when(answerRepository.findByAttemptAndPaperQuestion(any(), any())).thenAnswer(invocation -> {
            ExamPaperQuestion question = invocation.getArgument(1);
            return savedAnswers.stream()
                    .filter(answer -> answer.getPaperQuestion() == question)
                    .findFirst();
        });
        when(answerRepository.findByAttemptOrderByPaperQuestionPositionAsc(attempt)).thenAnswer(invocation -> savedAnswers);
        when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(paper)).thenReturn(List.of(questionOne, questionTwo));
        when(snapshotRepository.findByExamPaperQuestion(questionOne)).thenReturn(Optional.of(snapshotOne));
        when(snapshotRepository.findByExamPaperQuestion(questionTwo)).thenReturn(Optional.of(snapshotTwo));
    }

    @Test
    void submitGradesAttemptFromPaperSnapshots() {
        attempt.getAssignment().setResultVisibility(ExamResultVisibility.SCORE_AND_ANSWERS);
        var request = new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "a"),
                new SaveExamAttemptAnswersRequest.Answer(questionTwo.getId(), "B")
        ));

        var response = service.submit(attempt.getId(), user.getId(), request);

        assertThat(response.status()).isEqualTo(ExamAttemptStatus.GRADED.name());
        assertThat(response.correctCount()).isEqualTo(1);
        assertThat(response.totalQuestions()).isEqualTo(2);
        assertThat(response.score()).isEqualByComparingTo("50.00");
        assertThat(response.passed()).isFalse();
        assertThat(response.answers()).hasSize(2);
        assertThat(savedAnswers).extracting(ExamAttemptAnswer::getCorrect).containsExactly(true, false);
    }

    @Test
    void submitHidesAnswerKeyWhenAssignmentUsesScoreOnlyPolicy() {
        var request = new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "A")
        ));

        var response = service.submit(attempt.getId(), user.getId(), request);

        assertThat(response.status()).isEqualTo(ExamAttemptStatus.GRADED.name());
        assertThat(response.score()).isEqualByComparingTo("50.00");
        assertThat(response.questions()).hasSize(2);
        assertThat(response.answers()).isEmpty();
    }

    @Test
    void getForUserAutoGradesAttemptWhenDeadlinePassed() {
        attempt.setExpiresAt(LocalDateTime.now().minusMinutes(1));

        var response = service.getForUser(attempt.getId(), user.getId());

        assertThat(response.status()).isEqualTo(ExamAttemptStatus.GRADED.name());
        assertThat(response.score()).isEqualByComparingTo("0.00");
        assertThat(response.submittedAt()).isEqualTo(attempt.getExpiresAt());
        verify(attemptRepository).save(attempt);
    }

    @Test
    void saveAfterDeadlineAutoGradesLatestAnswers() {
        attempt.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        var request = new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "A")
        ));

        var response = service.saveAnswers(attempt.getId(), user.getId(), request);

        assertThat(response.status()).isEqualTo(ExamAttemptStatus.GRADED.name());
        assertThat(response.score()).isEqualByComparingTo("50.00");
        assertThat(savedAnswers).extracting(ExamAttemptAnswer::getSelectedAnswer).contains("A");
    }

    @Test
    void startCapsAttemptExpiryAtAssignmentDueDate() {
        ExamAssignment assignment = attempt.getAssignment();
        LocalDateTime dueAt = LocalDateTime.now().plusMinutes(5);
        assignment.setDueAt(dueAt);
        assignment.setMaxAttempts(2);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(assignmentService.find(assignment.getId())).thenReturn(assignment);
        when(targetRepository.findByAssignmentAndUserForUpdate(assignment, user))
                .thenReturn(Optional.of(ExamAssignmentTarget.builder()
                        .assignment(assignment)
                        .user(user)
                        .build()));
        when(attemptRepository.findByAssignmentAndUserOrderByAttemptNumberDesc(assignment, user))
                .thenReturn(List.of());
        when(attemptRepository.countByAssignmentAndUser(assignment, user)).thenReturn(0L);

        var response = service.start(assignment.getId(), user.getId());

        assertThat(response.expiresAt()).isEqualTo(dueAt);
        assertThat(response.status()).isEqualTo(ExamAttemptStatus.IN_PROGRESS.name());
    }

    private ExamPaperQuestion paperQuestion(Long id, ExamPaper paper, int position) {
        return ExamPaperQuestion.builder()
                .id(id)
                .examPaper(paper)
                .question(QuestionBankQuestion.builder().id(id + 100).build())
                .position(position)
                .build();
    }

    private ExamPaperQuestionSnapshot snapshot(ExamPaperQuestion question, String correctAnswer) {
        return ExamPaperQuestionSnapshot.builder()
                .id(question.getId() + 200)
                .examPaperQuestion(question)
                .stem("Câu hỏi " + question.getPosition())
                .optionA("A")
                .optionB("B")
                .optionC("C")
                .optionD("D")
                .correctAnswer(correctAnswer)
                .snapshotAt(LocalDateTime.now())
                .build();
    }
}
