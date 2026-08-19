package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.notification.repository.NotificationRepository;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.SaveExamAttemptAnswersRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.AssignmentTargetType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCellResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCognitiveResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * L2 integration tests — sheet {@code L2-ExamEvaluation}, ids L2-EXM-04…11 (01–03 live in
 * {@code EvaluationDashboardControllerIntegrationTest}).
 *
 * <p>Not {@code @Transactional}: L2-EXM-10 asserts the AFTER_COMMIT chain
 * (ExamAttemptPassedEvent → ExamPassedTrainingListener → training record + notification), which
 * only fires on a real commit. Fixtures use unique codes; assertions are id-scoped.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(CapturingEmailProducerConfig.class)
class ExamAttemptFlowIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private ExamAttemptService attemptService;
    @Autowired
    private ExamAttemptRepository attemptRepository;
    @Autowired
    private ExamAttemptFieldResultRepository fieldResultRepository;
    @Autowired
    private ExamAttemptCognitiveResultRepository cognitiveResultRepository;
    @Autowired
    private ExamAttemptCellResultRepository cellResultRepository;
    @Autowired
    private ExamAssignmentRepository assignmentRepository;
    @Autowired
    private ExamAssignmentTargetRepository targetRepository;
    @Autowired
    private ExamPaperRepository paperRepository;
    @Autowired
    private vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository examConfigRepository;
    @Autowired
    private ExamPaperQuestionRepository paperQuestionRepository;
    @Autowired
    private ExamPaperQuestionSnapshotRepository snapshotRepository;
    @Autowired
    private QuestionBankQuestionRepository questionRepository;
    @Autowired
    private QuestionCategoryRepository categoryRepository;
    @Autowired
    private ProfessionalFieldRepository professionalFieldRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TrainingRecordRepository trainingRecordRepository;
    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;
    @Autowired
    private NotificationRepository notificationRepository;
    @Autowired
    private Clock clock;
    @Autowired
    private ZoneId examBusinessZone;

    private int seq;
    private User employee;
    private ExamPaper paper;
    private List<ExamPaperQuestion> paperQuestions;
    private QuestionCategory category;
    private ProfessionalField professionalField;

    @BeforeEach
    void setUp() {
        seq = SEQ.incrementAndGet();
        employee = userRepository.save(User.builder()
                .employeeCode("EXM%03d".formatted(seq))
                .email("exm%03d@example.com".formatted(seq))
                .name("Exam Taker " + seq)
                .password("secret")
                .status(UserStatus.ACTIVE)
                .build());
        professionalField = professionalFieldRepository.save(ProfessionalField.builder()
                .code("EXM-FIELD-%03d".formatted(seq))
                .name("Lĩnh vực kiểm tra " + seq)
                .active(true)
                .build());
        category = categoryRepository.save(QuestionCategory.builder()
                .code("EXM-CAT-%03d".formatted(seq))
                .name("Danh mục kiểm tra " + seq)
                .status(QuestionCategoryStatus.ACTIVE)
                .createdBy("integration-test")
                .build());
        vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig config =
                examConfigRepository.save(vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig.builder()
                        .name("Cấu hình kiểm tra " + seq)
                        .totalQuestions(2)
                        .timeLimitMinutes(30)
                        .passingScore(70)
                        .maxRetakes(3)
                        .shuffleQuestions(false)
                        .shuffleOptions(false)
                        .status(vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus.ACTIVE)
                        .build());
        paper = paperRepository.save(ExamPaper.builder()
                .examConfig(config)
                .code("EXM-PAPER-%03d".formatted(seq))
                .name("Đề an toàn người bệnh " + seq)
                .status(ExamPaperStatus.PUBLISHED)
                .totalQuestions(2)
                .timeLimitMinutes(30)
                .passingScore(70)      // 0–100 scale on purpose: exercises the >10 rescale branch
                .version(1)
                .randomSeed(1L)
                .build());
        paperQuestions = List.of(seedQuestion(1), seedQuestion(2));
    }

    // ── start() ───────────────────────────────────────────────────────────────

    @DisplayName("L2-EXM-04 | Negative: a user outside the assignment targets cannot start → 'Bạn không nằm trong danh sách được phân công'")
    @Test
    void nonTargetUserCannotStart() {
        ExamAssignment assignment = seedAssignment(2, null);
        User outsider = userRepository.save(User.builder()
                .employeeCode("EXMOUT%03d".formatted(seq))
                .name("Outsider").password("secret").status(UserStatus.ACTIVE)
                .build());

        assertThatThrownBy(() -> attemptService.start(assignment.getId(), outsider.getId()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Bạn không nằm trong danh sách được phân công");
        assertThat(attemptsOf(assignment)).isEmpty();
    }

    @DisplayName("L2-EXM-05 | Negative: maxAttempts is enforced on the real count → 'Bạn đã dùng hết số lượt làm bài'")
    @Test
    void maxAttemptsIsEnforced() {
        ExamAssignment assignment = seedAssignment(1, null);

        ExamAttemptResponse first = attemptService.start(assignment.getId(), employee.getId());
        attemptService.submit(first.id(), employee.getId(), answers("A", "B")); // consumes the only attempt

        assertThatThrownBy(() -> attemptService.start(assignment.getId(), employee.getId()))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Bạn đã dùng hết số lượt làm bài");
        assertThat(attemptsOf(assignment)).hasSize(1);
    }

    @DisplayName("L2-EXM-06 | Idempotency: starting again while an unexpired attempt is IN_PROGRESS returns it instead of creating a new row")
    @Test
    void startIsIdempotentWhileInProgress() {
        ExamAssignment assignment = seedAssignment(3, null);

        ExamAttemptResponse first = attemptService.start(assignment.getId(), employee.getId());
        ExamAttemptResponse again = attemptService.start(assignment.getId(), employee.getId());

        assertThat(again.id()).isEqualTo(first.id());
        List<ExamAttempt> rows = attemptsOf(assignment);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getAttemptNumber()).isEqualTo(1);
        assertThat(rows.get(0).getStatus()).isEqualTo(ExamAttemptStatus.IN_PROGRESS);
    }

    @DisplayName("L2-EXM-07 | Query Correctness: expiresAt is min(now + timeLimit, dueAt) — a close dueAt caps the countdown")
    @Test
    void dueAtCapsTheExpiry() {
        LocalDateTime dueAt = now().plusMinutes(10); // paper allows 30
        ExamAssignment assignment = seedAssignment(1, dueAt);

        ExamAttemptResponse response = attemptService.start(assignment.getId(), employee.getId());

        ExamAttempt attempt = attemptRepository.findById(response.id()).orElseThrow();
        assertThat(attempt.getExpiresAt()).isCloseTo(dueAt, within(java.time.temporal.ChronoUnit.SECONDS.getDuration().multipliedBy(1)));
    }

    // ── expiry semantics ──────────────────────────────────────────────────────

    @DisplayName("L2-EXM-08 | Transaction Boundary: a save after the deadline auto-grades with submittedAt = expiresAt and DISCARDS the late answers")
    @Test
    void lateSaveAutoGradesAtTheExpiryInstant() {
        ExamAssignment assignment = seedAssignment(1, null);
        ExamAttemptResponse started = attemptService.start(assignment.getId(), employee.getId());
        // withNano(0): H2 stores TIMESTAMP at microsecond precision, so a nanosecond-carrying
        // LocalDateTime would round-trip unequal.
        LocalDateTime forcedExpiry = now().minusMinutes(5).withNano(0);
        forceExpiry(started.id(), forcedExpiry);

        attemptService.saveAnswers(started.id(), employee.getId(), answers("A", "A")); // both correct, but late

        ExamAttempt graded = attemptRepository.findById(started.id()).orElseThrow();
        assertThat(graded.getStatus()).isEqualTo(ExamAttemptStatus.GRADED);
        assertThat(graded.getSubmittedAt()).isEqualTo(forcedExpiry); // capped at the deadline
        // The time limit is enforced server-side: answers arriving after expiry are dropped, so the
        // attempt is graded on whatever was autosaved before the deadline (nothing, in this case).
        assertThat(graded.getCorrectCount()).isZero();
        assertThat(graded.getScore()).isEqualByComparingTo("0.00");

        assertThatThrownBy(() -> attemptService.saveAnswers(started.id(), employee.getId(), answers("B", "B")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Lượt làm bài không còn ở trạng thái đang làm");
    }

    @DisplayName("L2-EXM-08b | Security: answers autosaved BEFORE the deadline are kept when a late save closes the attempt")
    @Test
    void lateSaveKeepsAnswersSavedBeforeExpiry() {
        ExamAssignment assignment = seedAssignment(1, null);
        ExamAttemptResponse started = attemptService.start(assignment.getId(), employee.getId());

        attemptService.saveAnswers(started.id(), employee.getId(), answers("A", "B")); // in time: 1 correct

        forceExpiry(started.id(), now().minusMinutes(5).withNano(0));
        // A late attempt to "fix" the second answer must not change the outcome.
        attemptService.saveAnswers(started.id(), employee.getId(), answers("A", "A"));

        ExamAttempt graded = attemptRepository.findById(started.id()).orElseThrow();
        assertThat(graded.getStatus()).isEqualTo(ExamAttemptStatus.GRADED);
        assertThat(graded.getCorrectCount()).isEqualTo(1);
        assertThat(graded.getScore()).isEqualByComparingTo("5.00");
    }

    @DisplayName("L2-EXM-09 | Query Correctness: a read (listForUser) grades an expired IN_PROGRESS attempt — a write on a GET")
    @Test
    void listForUserGradesExpiredAttempts() {
        ExamAssignment assignment = seedAssignment(1, null);
        ExamAttemptResponse started = attemptService.start(assignment.getId(), employee.getId());
        forceExpiry(started.id(), now().minusMinutes(1));

        attemptService.listForUser(employee.getId());

        // Pins the current behaviour: expireIfNeeded() runs inside the read paths, so a GET mutates
        // DB state. Recorded in the workbook Notes as a surprising-but-intentional contract.
        assertThat(attemptRepository.findById(started.id()).orElseThrow().getStatus())
                .isEqualTo(ExamAttemptStatus.GRADED);
    }

    // ── submit + grading + AFTER_COMMIT chain ─────────────────────────────────

    @DisplayName("L2-EXM-10 | Event Published: a passed submit must create the EXAM_PASSED training record and notification after commit (D33)")
    @Test
    void passedSubmitTriggersTheAfterCommitChain() {
        // D33 (fixed): ExamPassedTrainingListener now runs in its own transaction
        // (@Transactional REQUIRES_NEW). Without it the AFTER_COMMIT save reused the committed
        // transaction's EntityManager, Hibernate handed back a DelayedPostInsertIdentifier and
        // the resulting ClassCastException was swallowed by the listener's catch — so passing an
        // exam never created the CME record nor the notification.
        ExamAssignment assignment = seedAssignment(1, null);
        ExamAttemptResponse started = attemptService.start(assignment.getId(), employee.getId());

        ExamAttemptResponse graded = attemptService.submit(started.id(), employee.getId(), answers("A", "A"));

        // Grading: 2/2 correct → 10.00; passingScore 70 (0–100) is rescaled to 7.0 → passed.
        ExamAttempt attempt = attemptRepository.findById(graded.id()).orElseThrow();
        assertThat(attempt.getStatus()).isEqualTo(ExamAttemptStatus.GRADED);
        assertThat(attempt.getScore()).isEqualByComparingTo("10.00");
        assertThat(attempt.getPassed()).isTrue();
        assertThat(attempt.getClassification()).isNotNull();

        // AFTER_COMMIT listener effects (this class is not @Transactional, so the commit is real):
        String cmeRef = "EXAM_ASSIGNMENT:" + assignment.getId() + ":USER:" + employee.getId();
        List<TrainingRecord> records = trainingRecordRepository.findAll().stream()
                .filter(r -> cmeRef.equals(r.getSourceReference()))
                .toList();
        assertThat(records).hasSize(1);
        assertThat(records.get(0).getWorkflowStatus()).isEqualTo(TrainingRecordStatus.SUBMITTED);
        assertThat(records.get(0).getDeclaredHours()).isEqualByComparingTo("1.0");
        assertThat(records.get(0).getEmployee().getId()).isEqualTo(employee.getId());

        assertThat(activityTypeRepository.findByCode("EXAM_PASSED")).isPresent();

        assertThat(notificationRepository.findAll().stream()
                .filter(n -> n.getUser().getId().equals(employee.getId()))
                .filter(n -> n.getDedupKey() != null && n.getDedupKey().contains("EXAM_PASSED:" + attempt.getId()))
                .toList()).hasSize(1);
    }

    @DisplayName("L2-EXM-11 | Negative: a failed submit is graded but publishes nothing — no training record, no notification")
    @Test
    void failedSubmitPublishesNothing() {
        ExamAssignment assignment = seedAssignment(1, null);
        ExamAttemptResponse started = attemptService.start(assignment.getId(), employee.getId());

        attemptService.submit(started.id(), employee.getId(), answers("A", "B")); // 1/2 → 5.00 < 7.0

        ExamAttempt attempt = attemptRepository.findById(started.id()).orElseThrow();
        assertThat(attempt.getStatus()).isEqualTo(ExamAttemptStatus.GRADED);
        assertThat(attempt.getScore()).isEqualByComparingTo("5.00");
        assertThat(attempt.getPassed()).isFalse();

        assertThat(trainingRecordRepository.findAll().stream()
                .filter(r -> r.getSourceReference() != null && r.getSourceReference().startsWith("EXAM_"))
                .toList()).isEmpty();
        assertThat(notificationRepository.findAll().stream()
                .filter(n -> n.getDedupKey() != null && n.getDedupKey().contains("EXAM_PASSED:" + attempt.getId()))
                .toList()).isEmpty();
    }

    @DisplayName("L2-EXM-12 | Phase 7: grading writes field/cognitive/cell aggregates from question snapshots")
    @Test
    void gradingWritesSnapshotBasedResultAggregates() {
        ExamAssignment assignment = seedAssignment(1, null);
        ExamAttemptResponse graded = attemptService.submit(
                attemptService.start(assignment.getId(), employee.getId()).id(),
                employee.getId(),
                answers("A", "B")
        );
        ExamAttempt attempt = attemptRepository.findById(graded.id()).orElseThrow();

        var fieldResults = fieldResultRepository.findByAttemptOrderByProfessionalFieldIdAsc(attempt);
        assertThat(fieldResults).singleElement();
        var field = fieldResults.get(0);
        assertThat(field.getProfessionalFieldId()).isEqualTo(professionalField.getId());
        assertThat(field.getProfessionalFieldCode()).isEqualTo(professionalField.getCode());
        assertThat(field.getProfessionalFieldName()).isEqualTo(professionalField.getName());
        assertThat(field.getCorrectCount()).isEqualTo(1);
        assertThat(field.getTotalQuestions()).isEqualTo(2);
        assertThat(field.getScore()).isEqualByComparingTo("5.00");
        assertThat(field.getPassingThreshold()).isEqualByComparingTo("7.00");
        assertThat(field.getPassed()).isFalse();

        assertThat(cognitiveResultRepository.findByAttemptOrderByCognitiveLevelAsc(attempt))
                .singleElement()
                .satisfies(cognitive -> {
                    assertThat(cognitive.getCognitiveLevel()).isEqualTo(CognitiveLevel.FOUNDATION);
                    assertThat(cognitive.getCorrectCount()).isEqualTo(1);
                    assertThat(cognitive.getTotalQuestions()).isEqualTo(2);
                });
        assertThat(cellResultRepository.findByAttemptOrderByProfessionalFieldIdAscCognitiveLevelAsc(attempt))
                .singleElement()
                .satisfies(cell -> {
                    assertThat(cell.getProfessionalFieldName()).isEqualTo(professionalField.getName());
                    assertThat(cell.getTotalQuestions()).isEqualTo(2);
                    assertThat(cell.getSmallSample()).isFalse();
                });
    }

    // ── fixtures ──────────────────────────────────────────────────────────────

    private ExamPaperQuestion seedQuestion(int position) {
        QuestionBankQuestion bankQuestion = questionRepository.save(QuestionBankQuestion.builder()
                .stem("Câu hỏi %d của đề %d".formatted(position, seq))
                .category(category)
                .professionalField(professionalField)
                .cognitiveLevel(CognitiveLevel.FOUNDATION)
                .cognitiveVerifiedAt(java.time.LocalDateTime.now())
                .cognitiveVerifiedBy("integration-test")
                .optionA("Đáp án đúng")
                .optionB("Sai 1")
                .optionC("Sai 2")
                .optionD("Sai 3")
                .correctAnswer("A")
                .language("vi")
                .questionType(vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType.ORIGINAL)
                .status(QuestionBankStatus.APPROVED)
                .build());
        ExamPaperQuestion paperQuestion = paperQuestionRepository.save(ExamPaperQuestion.builder()
                .examPaper(paper)
                .question(bankQuestion)
                .position(position)
                .points(BigDecimal.ONE)
                .build());
        snapshotRepository.save(ExamPaperQuestionSnapshot.builder()
                .examPaperQuestion(paperQuestion)
                .stem(bankQuestion.getStem())
                .optionA(bankQuestion.getOptionA())
                .optionB(bankQuestion.getOptionB())
                .optionC(bankQuestion.getOptionC())
                .optionD(bankQuestion.getOptionD())
                .correctAnswer("A")
                .categoryId(category.getId())
                .categoryCode(category.getCode())
                .categoryName(category.getName())
                .professionalFieldId(professionalField.getId())
                .professionalFieldCode(professionalField.getCode())
                .professionalFieldName(professionalField.getName())
                .cognitiveLevel(CognitiveLevel.FOUNDATION.name())
                .cognitiveLabel("Kiến thức nền tảng")
                .cognitiveVerifiedAt(bankQuestion.getCognitiveVerifiedAt())
                .cognitiveVerifiedBy(bankQuestion.getCognitiveVerifiedBy())
                .snapshotAt(now())
                .build());
        return paperQuestion;
    }

    private ExamAssignment seedAssignment(int maxAttempts, LocalDateTime dueAt) {
        ExamAssignment assignment = assignmentRepository.save(ExamAssignment.builder()
                .name("Đợt kiểm tra %d".formatted(seq))
                .examPaper(paper)
                .status(ExamAssignmentStatus.OPEN)
                .maxAttempts(maxAttempts)
                .dueAt(dueAt)
                .resultVisibility(ExamResultVisibility.SCORE_AND_ANSWERS)
                .build());
        targetRepository.save(ExamAssignmentTarget.builder()
                .assignment(assignment)
                .user(employee)
                .targetType(AssignmentTargetType.EMPLOYEE)
                .build());
        return assignment;
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock.withZone(examBusinessZone));
    }

    private SaveExamAttemptAnswersRequest answers(String first, String second) {
        return new SaveExamAttemptAnswersRequest(List.of(
                new SaveExamAttemptAnswersRequest.Answer(paperQuestions.get(0).getId(), first),
                new SaveExamAttemptAnswersRequest.Answer(paperQuestions.get(1).getId(), second)));
    }

    private void forceExpiry(Long attemptId, LocalDateTime expiresAt) {
        ExamAttempt attempt = attemptRepository.findById(attemptId).orElseThrow();
        attempt.setExpiresAt(expiresAt);
        attemptRepository.save(attempt);
    }

    private List<ExamAttempt> attemptsOf(ExamAssignment assignment) {
        return attemptRepository.findAll().stream()
                .filter(attempt -> attempt.getAssignment().getId().equals(assignment.getId()))
                .toList();
    }
}
