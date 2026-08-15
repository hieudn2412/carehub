package vn.vietduc.carehubbackend.common;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import vn.vietduc.carehubbackend.config.CapturingEmailProducerConfig;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintCell;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionCategory;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.GenerateExamPaperRequest;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionCategoryStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionSet;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.AssignmentTargetType;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamConfigStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionSetStatus;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamConfigRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperGenerationBatchRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintCellRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionSetRepository;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamAttemptService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamPaperService;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamGenerationDeterminism;
import vn.vietduc.carehubbackend.questiongeneration.service.ExamConfigService;
import vn.vietduc.carehubbackend.systemsettings.entity.SystemSetting;
import vn.vietduc.carehubbackend.systemsettings.repository.SystemSettingRepository;
import vn.vietduc.carehubbackend.systemsettings.service.SystemSettingsService;
import vn.vietduc.carehubbackend.training.entity.TrainingActivityType;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.DurationUnit;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.repository.TrainingActivityTypeRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.entity.ProfessionalField;
import vn.vietduc.carehubbackend.training.repository.ProfessionalFieldRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.entity.UserStatus;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * L2 integration tests — sheet {@code L2-Workflows}, ids L2-FLOW-01…03: true two-transaction
 * concurrency, which no other test in the suite exercises (the existing "optimistic lock" ITs all
 * send a stale version number in a single request).
 *
 * <p>Not {@code @Transactional} by necessity — each racing thread needs its own real transaction.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
@Import(CapturingEmailProducerConfig.class)
class ConcurrencyIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    private TransactionTemplate transactionTemplate;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private TrainingRecordRepository recordRepository;
    @Autowired
    private TrainingActivityTypeRepository activityTypeRepository;
    @Autowired
    private SystemSettingsService systemSettingsService;
    @Autowired
    private SystemSettingRepository systemSettingRepository;
    @Autowired
    private ExamAttemptService attemptService;
    @Autowired
    private ExamAttemptRepository attemptRepository;
    @Autowired
    private ExamAssignmentRepository assignmentRepository;
    @Autowired
    private ExamAssignmentTargetRepository targetRepository;
    @Autowired
    private ExamPaperRepository paperRepository;
    @Autowired
    private ExamConfigRepository examConfigRepository;
    @Autowired
    private QuestionSetRepository questionSetRepository;
    @Autowired
    private ExamPaperService examPaperService;
    @Autowired
    private ExamConfigService examConfigService;
    @Autowired
    private ExamPaperGenerationBatchRepository generationBatchRepository;
    @Autowired
    private ExamBlueprintFieldRepository blueprintFieldRepository;
    @Autowired
    private ExamBlueprintCellRepository blueprintCellRepository;
    @Autowired
    private QuestionBankQuestionRepository questionRepository;
    @Autowired
    private QuestionCategoryRepository questionCategoryRepository;
    @Autowired
    private ProfessionalFieldRepository professionalFieldRepository;

    private int seq;
    private User user;

    @BeforeEach
    void setUp() {
        seq = SEQ.incrementAndGet();
        user = userRepository.save(User.builder()
                .employeeCode("CONC%03d".formatted(seq))
                .email("conc%03d@example.com".formatted(seq))
                .name("Concurrent " + seq)
                .password("secret")
                .status(UserStatus.ACTIVE)
                .build());
    }

    @DisplayName("L2-FLOW-01 | Concurrency: two transactions editing the same training record — one commits, the loser gets ObjectOptimisticLockingFailureException")
    @Test
    void optimisticLockLetsExactlyOneWriterWin() throws Exception {
        TrainingActivityType type = activityTypeRepository.save(TrainingActivityType.builder()
                .code("CONC_TYPE_%03d".formatted(seq))
                .name("Concurrency type " + seq)
                .defaultDurationUnit(DurationUnit.HOUR)
                .requiresEvidence(false)
                .active(true)
                .build());
        TrainingRecord record = recordRepository.save(TrainingRecord.builder()
                .employee(user)
                .activityType(type)
                .title("Race target " + seq)
                .startDate(LocalDate.of(2026, 6, 1))
                .durationUnit(DurationUnit.HOUR)
                .declaredHours(BigDecimal.ONE)
                .workflowStatus(TrainingRecordStatus.DRAFT)
                .editCount(0)
                .createdByUser(user)
                .build());

        // Both threads read the SAME @Version value before either writes, then race to commit.
        CyclicBarrier bothLoaded = new CyclicBarrier(2);
        AtomicReference<Throwable> loser = new AtomicReference<>();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Runnable contender = () -> {
                try {
                    transactionTemplate.executeWithoutResult(status -> {
                        TrainingRecord loaded = recordRepository.findById(record.getId()).orElseThrow();
                        try {
                            bothLoaded.await(10, TimeUnit.SECONDS);
                        } catch (Exception e) {
                            throw new IllegalStateException(e);
                        }
                        loaded.setTitle(loaded.getTitle() + " / by " + Thread.currentThread().getName());
                        recordRepository.saveAndFlush(loaded);
                    });
                } catch (Throwable t) {
                    loser.compareAndSet(null, t);
                }
            };
            var f1 = pool.submit(contender);
            var f2 = pool.submit(contender);
            f1.get(30, TimeUnit.SECONDS);
            f2.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertThat(loser.get())
                .as("exactly one contender must lose on the @Version check")
                .isInstanceOf(ObjectOptimisticLockingFailureException.class);
        // The winner's title landed and the version advanced exactly once past the loser's read.
        TrainingRecord reloaded = recordRepository.findById(record.getId()).orElseThrow();
        assertThat(reloaded.getTitle()).contains(" / by ");
        assertThat(reloaded.getVersion()).isEqualTo(record.getVersion() + 1);
        // GlobalExceptionHandler maps this exception to 409 SYS_409 — the HTTP contract for the loser.
    }

    @DisplayName("L2-FLOW-02 | Constraint Violation: two first-time readers race SystemSettings getOrCreate — the loser hits the unique key, unmapped to any 4xx (D30)")
    @Test
    void systemSettingsCheckThenInsertRaceHitsTheUniqueKey() throws Exception {
        systemSettingRepository.findByScopeKey(SystemSetting.GLOBAL_SCOPE)
                .ifPresent(systemSettingRepository::delete);

        CountDownLatch insertedUncommitted = new CountDownLatch(1);
        CountDownLatch finishFirst = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        AtomicReference<Throwable> loser = new AtomicReference<>();
        try {
            // Thread A replays getOrCreate's check-then-insert and parks before commit.
            var first = pool.submit(() -> transactionTemplate.executeWithoutResult(status -> {
                if (systemSettingRepository.findByScopeKey(SystemSetting.GLOBAL_SCOPE).isEmpty()) {
                    systemSettingRepository.saveAndFlush(SystemSetting.builder()
                            .scopeKey(SystemSetting.GLOBAL_SCOPE)
                            .globalTrainingHours(SystemSetting.DEFAULT_TRAINING_HOURS)
                            .trainingWindowYears(SystemSetting.DEFAULT_TRAINING_WINDOW_YEARS)
                            .competencyTargetScore(SystemSetting.DEFAULT_COMPETENCY_TARGET_SCORE)
                            .lockVersion(0L)
                            .build());
                }
                insertedUncommitted.countDown();
                try {
                    finishFirst.await(10, TimeUnit.SECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }));
            // Thread B: the real service call. Its findByScopeKey misses (A uncommitted), so it
            // inserts too and blocks on the unique index until A commits — then violates it.
            var second = pool.submit(() -> {
                try {
                    insertedUncommitted.await(10, TimeUnit.SECONDS);
                    systemSettingsService.get();
                } catch (Throwable t) {
                    loser.set(t);
                }
            });
            Thread.sleep(300);       // let B reach the blocking insert
            finishFirst.countDown(); // A commits, B's insert resolves to a violation
            first.get(30, TimeUnit.SECONDS);
            second.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        // Pins D30: the loser surfaces DataIntegrityViolationException, and GlobalExceptionHandler
        // has no mapping for it — over HTTP this is a 500 SYS_001, not a 409.
        assertThat(loser.get()).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(systemSettingRepository.findAll().stream()
                .filter(s -> SystemSetting.GLOBAL_SCOPE.equals(s.getScopeKey()))
                .toList()).hasSize(1);
    }

    @DisplayName("L2-FLOW-03 | Concurrency: two simultaneous starts of the same exam target — the pessimistic lock serialises them into one attempt")
    @Test
    void doubleStartYieldsExactlyOneAttempt() throws Exception {
        QuestionSet set = questionSetRepository.save(QuestionSet.builder()
                .code("CONC-SET-%03d".formatted(seq))
                .name("Concurrency set " + seq)
                .status(QuestionSetStatus.ACTIVE)
                .questionCount(1)
                .build());
        var config = examConfigRepository.save(
                vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig.builder()
                        .name("Concurrency config " + seq)
                        .questionSet(set)
                        .totalQuestions(1)
                        .timeLimitMinutes(30)
                        .passingScore(70)
                        .maxRetakes(3)
                        .shuffleQuestions(false)
                        .shuffleOptions(false)
                        .status(ExamConfigStatus.ACTIVE)
                        .build());
        ExamPaper paper = paperRepository.save(ExamPaper.builder()
                .examConfig(config)
                .questionSet(set)
                .code("CONC-PAPER-%03d".formatted(seq))
                .name("Concurrency paper " + seq)
                .status(ExamPaperStatus.PUBLISHED)
                .totalQuestions(1)
                .timeLimitMinutes(30)
                .passingScore(70)
                .version(1)
                .randomSeed(1L)
                .build());
        ExamAssignment assignment = assignmentRepository.save(ExamAssignment.builder()
                .name("Concurrency assignment " + seq)
                .examPaper(paper)
                .status(ExamAssignmentStatus.OPEN)
                .maxAttempts(2)
                .resultVisibility(ExamResultVisibility.SCORE_ONLY)
                .build());
        targetRepository.save(ExamAssignmentTarget.builder()
                .assignment(assignment)
                .user(user)
                .targetType(AssignmentTargetType.EMPLOYEE)
                .build());

        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        try {
            Runnable starter = () -> {
                try {
                    startTogether.await(10, TimeUnit.SECONDS);
                    attemptService.start(assignment.getId(), user.getId());
                } catch (Throwable t) {
                    failure.compareAndSet(null, t);
                }
            };
            var f1 = pool.submit(starter);
            var f2 = pool.submit(starter);
            f1.get(30, TimeUnit.SECONDS);
            f2.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        // The PESSIMISTIC_WRITE on the assignment target serialises the two starts: the second
        // transaction finds the first's IN_PROGRESS attempt and returns it instead of inserting.
        // Either way uq_exam_attempt_number must hold — exactly one row, attempt_number 1.
        assertThat(failure.get())
                .as("neither start may fail; H2's FOR UPDATE semantics differ from Postgres — see Notes")
                .isNull();
        List<vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt> attempts =
                attemptRepository.findAll().stream()
                        .filter(a -> a.getAssignment().getId().equals(assignment.getId()))
                        .toList();
        assertThat(attempts).hasSize(1);
        assertThat(attempts.get(0).getAttemptNumber()).isEqualTo(1);
    }

    @DisplayName("L2-FLOW-04 | Concurrency: cùng idempotency key chỉ tạo một batch và một mã đề")
    @Test
    void concurrentPaperGenerationCreatesOneBatch() throws Exception {
        ProfessionalField field = professionalFieldRepository.save(ProfessionalField.builder()
                .code("CONC_FIELD_%03d".formatted(seq))
                .name("Lĩnh vực concurrent " + seq)
                .active(true)
                .build());
        QuestionCategory category = questionCategoryRepository.save(QuestionCategory.builder()
                .code("CONC_CAT_%03d".formatted(seq))
                .name("Danh mục concurrent " + seq)
                .status(QuestionCategoryStatus.ACTIVE)
                .createdBy("test")
                .build());
        QuestionBankQuestion question = questionRepository.save(QuestionBankQuestion.builder()
                .stem("Câu hỏi concurrent " + seq)
                .optionA("A").optionB("B").optionC("C").optionD("D")
                .correctAnswer("A").language("vi")
                .category(category).professionalField(field)
                .cognitiveLevel(CognitiveLevel.FOUNDATION)
                .cognitiveVerifiedAt(java.time.LocalDateTime.now()).cognitiveVerifiedBy("reviewer")
                .questionType(QuestionType.ORIGINAL).status(QuestionBankStatus.APPROVED)
                .createdBy("test")
                .build());
        var config = examConfigRepository.save(vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig.builder()
                .name("Direct generation config " + seq)
                .questionSet(null)
                .sourceScope("QUESTION_BANK")
                .blueprintVersion(1)
                .totalQuestions(1)
                .timeLimitMinutes(15)
                .passingScore(7)
                .maxRetakes(0)
                .shuffleQuestions(true)
                .shuffleOptions(true)
                .status(ExamConfigStatus.ACTIVE)
                .build());
        ExamBlueprintField blueprintField = blueprintFieldRepository.save(ExamBlueprintField.builder()
                .examConfig(config).professionalField(field).percentage(BigDecimal.valueOf(100))
                .questionCount(1).displayOrder(0).build());
        blueprintCellRepository.save(ExamBlueprintCell.builder()
                .blueprintField(blueprintField).cognitiveLevel(CognitiveLevel.FOUNDATION)
                .percentage(BigDecimal.valueOf(100)).questionCount(1).build());
        blueprintCellRepository.save(ExamBlueprintCell.builder()
                .blueprintField(blueprintField).cognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION)
                .percentage(BigDecimal.ZERO).questionCount(0).build());
        blueprintCellRepository.save(ExamBlueprintCell.builder()
                .blueprintField(blueprintField).cognitiveLevel(CognitiveLevel.CLINICAL_REASONING_ANALYSIS)
                .percentage(BigDecimal.ZERO).questionCount(0).build());
        examConfigService.previewExisting(config.getId());

        String key = "concurrent-paper-" + seq;
        GenerateExamPaperRequest request = new GenerateExamPaperRequest(
                config.getId(), "Đề concurrent", 1, 123L, key, false);
        CyclicBarrier startTogether = new CyclicBarrier(2);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        try {
            Runnable generator = () -> {
                try {
                    startTogether.await(10, TimeUnit.SECONDS);
                    examPaperService.generate(request, "publisher");
                } catch (Throwable throwable) {
                    failure.compareAndSet(null, throwable);
                }
            };
            var first = pool.submit(generator);
            var second = pool.submit(generator);
            first.get(30, TimeUnit.SECONDS);
            second.get(30, TimeUnit.SECONDS);
        } finally {
            pool.shutdownNow();
        }

        assertThat(failure.get()).isNull();
        var storedBatch = generationBatchRepository.findByIdempotencyKey(key);
        assertThat(storedBatch).isPresent();
        assertThat(paperRepository.countByGenerationBatchId(storedBatch.orElseThrow().getId())).isEqualTo(1);
    }

    @DisplayName("L2-FLOW-05 | Atomicity: thiếu một ô blueprint rollback toàn bộ batch sinh đề")
    @Test
    void blueprintCellShortageRollsBackGenerationBatch() {
        ProfessionalField field = professionalFieldRepository.save(ProfessionalField.builder()
                .code("ROLLBACK_FIELD_%03d".formatted(seq))
                .name("Lĩnh vực rollback " + seq)
                .active(true)
                .build());
        QuestionCategory category = questionCategoryRepository.save(QuestionCategory.builder()
                .code("ROLLBACK_CAT_%03d".formatted(seq))
                .name("Danh mục rollback " + seq)
                .status(QuestionCategoryStatus.ACTIVE)
                .createdBy("test")
                .build());
        questionRepository.save(QuestionBankQuestion.builder()
                .stem("Câu nền tảng rollback " + seq)
                .optionA("A").optionB("B").optionC("C").optionD("D")
                .correctAnswer("A").language("vi")
                .category(category).professionalField(field)
                .cognitiveLevel(CognitiveLevel.FOUNDATION)
                .cognitiveVerifiedAt(java.time.LocalDateTime.now()).cognitiveVerifiedBy("reviewer")
                .questionType(QuestionType.ORIGINAL).status(QuestionBankStatus.APPROVED)
                .createdBy("test")
                .build());
        questionRepository.save(QuestionBankQuestion.builder()
                .stem("Câu áp dụng rollback " + seq)
                .optionA("A").optionB("B").optionC("C").optionD("D")
                .correctAnswer("A").language("vi")
                .category(category).professionalField(field)
                .cognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION)
                .cognitiveVerifiedAt(java.time.LocalDateTime.now()).cognitiveVerifiedBy("reviewer")
                .questionType(QuestionType.ORIGINAL).status(QuestionBankStatus.APPROVED)
                .createdBy("test")
                .build());
        var config = examConfigRepository.save(vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfig.builder()
                .name("Rollback generation config " + seq)
                .sourceScope("QUESTION_BANK")
                .blueprintVersion(1)
                .totalQuestions(2)
                .timeLimitMinutes(15)
                .passingScore(7)
                .maxRetakes(0)
                .shuffleQuestions(true)
                .shuffleOptions(true)
                .status(ExamConfigStatus.ACTIVE)
                .build());
        ExamBlueprintField blueprintField = blueprintFieldRepository.save(ExamBlueprintField.builder()
                .examConfig(config).professionalField(field).percentage(BigDecimal.valueOf(100))
                .questionCount(2).displayOrder(0).build());
        blueprintCellRepository.save(ExamBlueprintCell.builder()
                .blueprintField(blueprintField).cognitiveLevel(CognitiveLevel.FOUNDATION)
                .percentage(BigDecimal.valueOf(100)).questionCount(2).build());
        blueprintCellRepository.save(ExamBlueprintCell.builder()
                .blueprintField(blueprintField).cognitiveLevel(CognitiveLevel.CLINICAL_APPLICATION)
                .percentage(BigDecimal.ZERO).questionCount(0).build());
        blueprintCellRepository.save(ExamBlueprintCell.builder()
                .blueprintField(blueprintField).cognitiveLevel(CognitiveLevel.CLINICAL_REASONING_ANALYSIS)
                .percentage(BigDecimal.ZERO).questionCount(0).build());
        assertThat(examConfigService.previewExisting(config.getId()).valid()).isFalse();

        String key = "rollback-paper-" + seq;
        GenerateExamPaperRequest request = new GenerateExamPaperRequest(
                config.getId(), "Đề rollback", 1, 321L, key, false);

        assertThatThrownBy(() -> examPaperService.generate(request, "publisher"))
                .hasMessageContaining("Không đủ họ câu hỏi độc lập");
        assertThat(generationBatchRepository.findByIdempotencyKey(key)).isEmpty();
    }
}
