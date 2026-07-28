package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.SaveExamAttemptAnswersRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptQuestion;
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
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamQuestionSelectionMode;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamAttemptServiceTest {
    private final ExamAssignmentService assignmentService = mock(ExamAssignmentService.class);
    private final ExamAttemptRepository attemptRepository = mock(ExamAttemptRepository.class);
    private final ExamAttemptAnswerRepository answerRepository = mock(ExamAttemptAnswerRepository.class);
    private final ExamAttemptQuestionRepository attemptQuestionRepository = mock(ExamAttemptQuestionRepository.class);
    private final ExamAssignmentTargetRepository targetRepository = mock(ExamAssignmentTargetRepository.class);
    private final ExamPaperQuestionRepository paperQuestionRepository = mock(ExamPaperQuestionRepository.class);
    private final ExamPaperQuestionSnapshotRepository snapshotRepository = mock(ExamPaperQuestionSnapshotRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final CompetencyClassificationService classificationService = mock(CompetencyClassificationService.class);
    private final ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);
    private final AtomicLong ids = new AtomicLong(500);
    private final List<ExamAttemptAnswer> savedAnswers = new ArrayList<>();
    private final List<ExamAttemptQuestion> savedSelections = new ArrayList<>();
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
                attemptQuestionRepository,
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
                .passingScore(6)
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
                .passingScore(6)
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
        savedSelections.clear();

        when(attemptRepository.findById(attempt.getId())).thenReturn(Optional.of(attempt));
        when(attemptQuestionRepository.findByAttemptOrderByPositionAsc(any())).thenAnswer(invocation -> {
            ExamAttempt selectedAttempt = invocation.getArgument(0);
            return savedSelections.stream()
                    .filter(selection -> selection.getAttempt() == selectedAttempt)
                    .sorted(java.util.Comparator.comparing(ExamAttemptQuestion::getPosition))
                    .toList();
        });
        when(attemptQuestionRepository.findPreviouslySeenQuestionIds(any(), any(), any())).thenReturn(List.of());
        when(attemptQuestionRepository.save(any())).thenAnswer(invocation -> {
            ExamAttemptQuestion selection = invocation.getArgument(0);
            if (!savedSelections.contains(selection)) {
                savedSelections.add(selection);
            }
            return selection;
        });
        when(assignmentService.isAssignmentEnded(any(ExamAssignment.class), any(LocalDateTime.class)))
                .thenAnswer(invocation -> {
                    ExamAssignment checked = invocation.getArgument(0);
                    LocalDateTime now = invocation.getArgument(1);
                    return checked.getStatus() == ExamAssignmentStatus.CLOSED
                            || checked.getStatus() == ExamAssignmentStatus.ARCHIVED
                            || checked.getDueAt() != null && !now.isBefore(checked.getDueAt());
                });
        // Lượt đang xét đã tồn tại trong DB: mọi truy vấn đếm/liệt kê lượt phải nhìn thấy nó,
        // nếu không canRevealAnswers sẽ tưởng người dùng còn lượt chưa dùng.
        when(attemptRepository.findByAssignmentAndUserOrderByAttemptNumberDesc(assignment, user))
                .thenReturn(List.of(attempt));
        when(attemptRepository.countByAssignmentAndUser(assignment, user)).thenReturn(1L);
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
        attempt.getAssignment().setStatus(ExamAssignmentStatus.CLOSED);
        var request = new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "a"),
                new SaveExamAttemptAnswersRequest.Answer(questionTwo.getId(), "B")
        ));

        var response = service.submit(attempt.getId(), user.getId(), request);

        assertThat(response.status()).isEqualTo(ExamAttemptStatus.GRADED.name());
        assertThat(response.correctCount()).isEqualTo(1);
        assertThat(response.totalQuestions()).isEqualTo(2);
        assertThat(response.score()).isEqualByComparingTo("5.00");
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
        assertThat(response.score()).isEqualByComparingTo("5.00");
        assertThat(response.questions()).hasSize(2);
        assertThat(response.answers()).isEmpty();
    }

    @Test
    void scoreAndAnswersPolicyWaitsUntilAssignmentEnds() {
        ExamAssignment assignment = attempt.getAssignment();
        assignment.setResultVisibility(ExamResultVisibility.SCORE_AND_ANSWERS);
        assignment.setDueAt(LocalDateTime.now().plusHours(1));

        var submitted = service.submit(attempt.getId(), user.getId(), new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "A")
        )));

        assertThat(submitted.score()).isNull();
        assertThat(submitted.passed()).isNull();
        assertThat(submitted.questions()).isEmpty();
        assertThat(submitted.answers()).isEmpty();

        assignment.setStatus(ExamAssignmentStatus.CLOSED);
        var revealed = service.getForUser(attempt.getId(), user.getId());

        assertThat(revealed.score()).isEqualByComparingTo("5.00");
        assertThat(revealed.answers()).hasSize(2);
    }

    @Test
    void getForUserHidesAnswerKeyWhileAnotherAttemptIsStillInProgress() {
        // Cùng một phân công dùng chung một bộ đề: nếu còn lượt đang làm dở thì xem lại lượt cũ
        // không được lộ đáp án, nếu không người dùng chép đáp án sang lượt đang làm.
        ExamAssignment assignment = attempt.getAssignment();
        assignment.setResultVisibility(ExamResultVisibility.SCORE_AND_ANSWERS);
        assignment.setMaxAttempts(2);
        attempt.setStatus(ExamAttemptStatus.GRADED);
        attempt.setExpiresAt(null);
        ExamAttempt secondAttempt = ExamAttempt.builder()
                .id(71L)
                .assignment(assignment)
                .examPaper(attempt.getExamPaper())
                .user(user)
                .attemptNumber(2)
                .status(ExamAttemptStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(20))
                .totalQuestions(2)
                .build();
        when(attemptRepository.findByAssignmentAndUserOrderByAttemptNumberDesc(assignment, user))
                .thenReturn(List.of(secondAttempt, attempt));

        var response = service.getForUser(attempt.getId(), user.getId());

        assertThat(response.answers()).isEmpty();
        assertThat(response.questions()).isEmpty();
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
    void saveAfterDeadlineAutoGradesAndDiscardsLateAnswers() {
        attempt.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        var request = new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "A")
        ));

        var response = service.saveAnswers(attempt.getId(), user.getId(), request);

        // Time limit is enforced server-side: the attempt closes on whatever was saved before the
        // deadline, and the answers riding along with this late call are dropped.
        assertThat(response.status()).isEqualTo(ExamAttemptStatus.GRADED.name());
        assertThat(response.score()).isEqualByComparingTo("0.00");
        assertThat(savedAnswers).extracting(ExamAttemptAnswer::getSelectedAnswer).doesNotContain("A");
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

    @Test
    void startRejectsAssignmentBeforeAvailableFrom() {
        ExamAssignment assignment = attempt.getAssignment();
        assignment.setAvailableFrom(LocalDateTime.now().plusHours(1));
        assignment.setDueAt(LocalDateTime.now().plusDays(1));
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(assignmentService.find(assignment.getId())).thenReturn(assignment);

        assertThatThrownBy(() -> service.start(assignment.getId(), user.getId()))
                .isInstanceOf(vn.vietduc.carehubbackend.exception.BadRequestException.class)
                .hasMessageContaining("Chưa đến thời gian bắt đầu");
    }

    @Test
    void shuffledQuestionOrderIsStableForOneSeedAndVariesAcrossSeeds() {
        attempt.getAssignment().setShuffleQuestions(true);
        attempt.setPresentationSeed(100L);

        var firstLoad = service.getForUser(attempt.getId(), user.getId());
        var secondLoad = service.getForUser(attempt.getId(), user.getId());

        assertThat(secondLoad.questions())
                .extracting(response -> response.paperQuestionId())
                .containsExactlyElementsOf(firstLoad.questions().stream().map(response -> response.paperQuestionId()).toList());

        var firstQuestionIds = new HashSet<Long>();
        for (long seed = 1; seed <= 32; seed++) {
            attempt.setPresentationSeed(seed);
            firstQuestionIds.add(service.getForUser(attempt.getId(), user.getId()).questions().get(0).paperQuestionId());
        }
        assertThat(firstQuestionIds).containsExactlyInAnyOrder(questionOne.getId(), questionTwo.getId());
    }

    @Test
    void shuffledOptionsGradeAgainstDisplayedLabels() {
        attempt.getAssignment().setShuffleOptions(true);
        attempt.setPresentationSeed(12345L);
        var displayedQuestion = service.getForUser(attempt.getId(), user.getId()).questions().stream()
                .filter(question -> question.paperQuestionId().equals(questionOne.getId()))
                .findFirst()
                .orElseThrow();
        String displayedCorrectLabel = "A".equals(displayedQuestion.optionA()) ? "A"
                : "A".equals(displayedQuestion.optionB()) ? "B"
                : "A".equals(displayedQuestion.optionC()) ? "C"
                : "D";

        assertThat(displayedCorrectLabel).isNotEqualTo("A");
        var response = service.submit(attempt.getId(), user.getId(), new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), displayedCorrectLabel)
        )));

        assertThat(response.correctCount()).isEqualTo(1);
        assertThat(response.score()).isEqualByComparingTo("5.00");
    }

    @Test
    void hiddenUntilEndSuppressesScoreThenRevealsItAfterDeadline() {
        ExamAssignment assignment = attempt.getAssignment();
        assignment.setResultVisibility(ExamResultVisibility.HIDDEN_UNTIL_END);
        assignment.setDueAt(LocalDateTime.now().plusHours(1));

        var submitted = service.submit(attempt.getId(), user.getId(), new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(questionOne.getId(), "A")
        )));

        assertThat(submitted.score()).isNull();
        assertThat(submitted.correctCount()).isNull();
        assertThat(submitted.passed()).isNull();
        assertThat(submitted.questions()).isEmpty();
        assertThat(submitted.answers()).isEmpty();

        assignment.setDueAt(LocalDateTime.now().minusSeconds(1));
        var revealed = service.getForUser(attempt.getId(), user.getId());

        assertThat(revealed.score()).isEqualByComparingTo("5.00");
        assertThat(revealed.correctCount()).isEqualTo(1);
        assertThat(revealed.answers()).isEmpty();
    }

    @Test
    void balancedAttemptSelectsConfiguredDifficultyCountsAndPersistsPresentation() {
        ExamAssignment assignment = attempt.getAssignment();
        ExamConfig config = assignment.getExamPaper().getExamConfig();
        config.setQuestionSelectionMode(ExamQuestionSelectionMode.PER_ATTEMPT_BALANCED);
        config.setEasyPercentage(30);
        config.setMediumPercentage(50);
        config.setHardPercentage(20);
        config.setTotalQuestions(5);
        assignment.getExamPaper().setTotalQuestions(5);
        assignment.getExamPaper().setQuestionSelectionMode(ExamQuestionSelectionMode.PER_ATTEMPT_BALANCED);
        assignment.getExamPaper().setEasyPercentage(30);
        assignment.getExamPaper().setMediumPercentage(50);
        assignment.getExamPaper().setHardPercentage(20);
        assignment.setShuffleQuestions(true);
        assignment.setMaxAttempts(2);

        List<ExamPaperQuestion> pool = new ArrayList<>();
        addPoolQuestions(pool, assignment.getExamPaper(), "EASY", 3);
        addPoolQuestions(pool, assignment.getExamPaper(), "MEDIUM", 5);
        addPoolQuestions(pool, assignment.getExamPaper(), "HARD", 2);
        when(paperQuestionRepository.findByExamPaperOrderByPositionAsc(assignment.getExamPaper())).thenReturn(pool);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(assignmentService.find(assignment.getId())).thenReturn(assignment);
        when(targetRepository.findByAssignmentAndUserForUpdate(assignment, user))
                .thenReturn(Optional.of(ExamAssignmentTarget.builder().assignment(assignment).user(user).build()));
        when(attemptRepository.findByAssignmentAndUserOrderByAttemptNumberDesc(assignment, user)).thenReturn(List.of());
        when(attemptRepository.countByAssignmentAndUser(assignment, user)).thenReturn(0L);

        var response = service.start(assignment.getId(), user.getId());

        assertThat(response.questions()).hasSize(5);
        assertThat(savedSelections).hasSize(5);
        assertThat(savedSelections.stream()
                .map(selection -> snapshotRepository.findByExamPaperQuestion(selection.getPaperQuestion()).orElseThrow().getDifficulty())
                .collect(java.util.stream.Collectors.groupingBy(value -> value, java.util.stream.Collectors.counting())))
                .containsEntry("EASY", 1L)
                .containsEntry("MEDIUM", 3L)
                .containsEntry("HARD", 1L);
        assertThat(response.questions())
                .extracting(question -> question.paperQuestionId())
                .containsExactlyElementsOf(savedSelections.stream()
                        .sorted(java.util.Comparator.comparing(ExamAttemptQuestion::getPosition))
                        .map(selection -> selection.getPaperQuestion().getId())
                        .toList());
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

    private void addPoolQuestions(List<ExamPaperQuestion> pool, ExamPaper paper, String difficulty, int count) {
        for (int index = 0; index < count; index++) {
            long id = 1_000L + pool.size();
            ExamPaperQuestion question = paperQuestion(id, paper, pool.size() + 1);
            ExamPaperQuestionSnapshot questionSnapshot = snapshot(question, "A");
            questionSnapshot.setDifficulty(difficulty);
            pool.add(question);
            when(snapshotRepository.findByExamPaperQuestion(question)).thenReturn(Optional.of(questionSnapshot));
        }
    }
}
