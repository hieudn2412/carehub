package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.questiongeneration.event.ExamAttemptPassedEvent;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.SaveExamAttemptAnswersRequest;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptAnswerResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptQuestionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamQuestionSelectionMode;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamAttemptService {
    private static final Set<String> VALID_ANSWERS = Set.of("A", "B", "C", "D");

    private final ExamAssignmentService assignmentService;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAttemptAnswerRepository answerRepository;
    private final ExamAttemptQuestionRepository attemptQuestionRepository;
    private final ExamAssignmentTargetRepository targetRepository;
    private final ExamPaperQuestionRepository paperQuestionRepository;
    private final ExamPaperQuestionSnapshotRepository snapshotRepository;
    private final UserRepository userRepository;
    private final CompetencyClassificationService classificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;
    private final ZoneId examBusinessZone;

    @Transactional
    public List<ExamAttemptResponse> listAdmin(Long assignmentId, String status, Long professionalFieldId) {
        ExamAttemptStatus statusFilter = parseStatusOrNull(status);
        List<ExamAttempt> attempts;
        if (assignmentId != null) {
            ExamAssignment assignment = assignmentService.find(assignmentId);
            attempts = attemptRepository.findByAssignmentOrderByStartedAtDesc(assignment);
        } else if (statusFilter != null) {
            attempts = attemptRepository.findByStatusOrderByStartedAtDesc(statusFilter);
        } else {
            attempts = attemptRepository.findAllByOrderByStartedAtDesc();
        }
        return attempts.stream()
                .peek(this::expireIfNeeded)
                .filter(attempt -> statusFilter == null || attempt.getStatus() == statusFilter)
                .filter(attempt -> professionalFieldId == null
                        || (attempt.getAssignment().getProfessionalField() != null
                        && professionalFieldId.equals(attempt.getAssignment().getProfessionalField().getId())))
                .map(attempt -> toResponse(attempt, false, true, true))
                .toList();
    }

    @Transactional
    public ExamAttemptResponse getAdmin(Long attemptId) {
        ExamAttempt attempt = find(attemptId);
        expireIfNeeded(attempt);
        return toResponse(attempt, true, true, true);
    }

    @Transactional
    public List<ExamAttemptResponse> listForUser(Long userId) {
        User user = findUser(userId);
        return attemptRepository.findByUserOrderByStartedAtDesc(user).stream()
                .peek(this::expireIfNeeded)
                .map(attempt -> toResponse(attempt, false, false, canRevealScore(attempt)))
                .toList();
    }

    @Transactional
    public ExamAttemptResponse getForUser(Long attemptId, Long userId) {
        ExamAttempt attempt = find(attemptId);
        requireOwner(attempt, userId);
        expireIfNeeded(attempt);
        return toResponse(attempt, canRevealQuestionReview(attempt), canRevealAnswers(attempt), canRevealScore(attempt));
    }

    @Transactional
    public ExamAttemptResponse start(Long assignmentId, Long userId) {
        User user = findUser(userId);
        ExamAssignment assignment = assignmentService.find(assignmentId);
        validateStartableAssignment(assignment, user);

        List<ExamAttempt> existingAttempts = attemptRepository.findByAssignmentAndUserOrderByAttemptNumberDesc(assignment, user);
        for (ExamAttempt existingAttempt : existingAttempts) {
            if (existingAttempt.getStatus() == ExamAttemptStatus.IN_PROGRESS) {
                if (isExpired(existingAttempt)) {
                    gradeAttempt(existingAttempt, null, effectiveExpiry(existingAttempt));
                } else {
                    return toResponse(existingAttempt, true, false, true);
                }
            }
        }
        long attemptCount = attemptRepository.countByAssignmentAndUser(assignment, user);
        if (attemptCount >= assignment.getMaxAttempts()) {
            throw new BadRequestException("Bạn đã dùng hết số lượt làm bài");
        }

        LocalDateTime now = now();
        LocalDateTime expiresAt = now.plusMinutes(assignment.getExamPaper().getTimeLimitMinutes());
        if (assignment.getDueAt() != null && assignment.getDueAt().isBefore(expiresAt)) {
            expiresAt = assignment.getDueAt();
        }
        ExamAttempt attempt = attemptRepository.save(ExamAttempt.builder()
                .assignment(assignment)
                .examPaper(assignment.getExamPaper())
                .user(user)
                .attemptNumber((int) attemptCount + 1)
                .status(ExamAttemptStatus.IN_PROGRESS)
                .startedAt(now)
                .expiresAt(expiresAt)
                .totalQuestions(assignment.getExamPaper().getTotalQuestions())
                .presentationSeed(ThreadLocalRandom.current().nextLong())
                .build());
        initializeAttemptQuestions(attempt);
        return toResponse(attempt, true, false, true);
    }

    @Transactional
    public ExamAttemptResponse saveAnswers(Long attemptId, Long userId, SaveExamAttemptAnswersRequest request) {
        ExamAttempt attempt = find(attemptId);
        requireOwner(attempt, userId);
        ensureInProgress(attempt);
        if (isExpired(attempt)) {
            // Hết giờ: chốt bài bằng đáp án ĐÃ lưu trước hạn, bỏ qua payload gửi kèm
            // (nếu không, client sửa giờ máy vẫn nộp được đáp án mới sau khi hết giờ).
            ExamAttempt saved = gradeAttempt(attempt, null, effectiveExpiry(attempt));
            return toResponse(saved, canRevealQuestionReview(saved), canRevealAnswers(saved), canRevealScore(saved));
        }
        upsertAnswers(attempt, request);
        return toResponse(attempt, true, false, true);
    }

    @Transactional
    public ExamAttemptResponse submit(Long attemptId, Long userId, SaveExamAttemptAnswersRequest request) {
        ExamAttempt attempt = find(attemptId);
        requireOwner(attempt, userId);
        ensureInProgress(attempt);
        boolean expired = isExpired(attempt);
        LocalDateTime submittedAt = expired ? effectiveExpiry(attempt) : now();
        // Quá hạn thì chỉ chấm phần đã lưu trước hạn — đáp án gửi kèm lần nộp muộn bị bỏ qua.
        ExamAttempt saved = gradeAttempt(attempt, expired ? null : request, submittedAt);
        return toResponse(saved, canRevealQuestionReview(saved), canRevealAnswers(saved), canRevealScore(saved));
    }

    private ExamAttempt gradeAttempt(
            ExamAttempt attempt,
            SaveExamAttemptAnswersRequest request,
            LocalDateTime submittedAt
    ) {
        upsertAnswers(attempt, request);
        List<ExamPaperQuestion> questions = questionsForAttempt(attempt);
        Map<Long, ExamAttemptAnswer> answersByQuestionId = answerRepository.findByAttemptOrderByPaperQuestionPositionAsc(attempt).stream()
                .collect(Collectors.toMap(answer -> answer.getPaperQuestion().getId(), Function.identity()));
        int correctCount = 0;
        for (ExamPaperQuestion question : questions) {
            ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(question)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
            ExamAttemptAnswer answer = answersByQuestionId.computeIfAbsent(question.getId(), ignored -> answerRepository.save(
                    ExamAttemptAnswer.builder()
                            .attempt(attempt)
                            .paperQuestion(question)
                            .build()
            ));
            String displayedCorrectAnswer = optionPresentation(attempt, question, snapshot).correctAnswer();
            boolean correct = normalizeAnswer(answer.getSelectedAnswer()) != null
                    && normalizeAnswer(answer.getSelectedAnswer()).equals(normalizeAnswer(displayedCorrectAnswer));
            answer.setCorrect(correct);
            answerRepository.save(answer);
            if (correct) {
                correctCount++;
            }
        }
        int totalQuestions = questions.size();
        BigDecimal score = totalQuestions == 0
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(correctCount)
                .multiply(BigDecimal.valueOf(10))
                .divide(BigDecimal.valueOf(totalQuestions), 2, RoundingMode.HALF_UP);
        attempt.setStatus(ExamAttemptStatus.GRADED);
        attempt.setSubmittedAt(submittedAt);
        attempt.setCorrectCount(correctCount);
        attempt.setTotalQuestions(totalQuestions);
        attempt.setScore(score);
        BigDecimal paperPassingScore = BigDecimal.valueOf(attempt.getExamPaper().getPassingScore());
        if (paperPassingScore.compareTo(BigDecimal.valueOf(10)) > 0) {
            paperPassingScore = paperPassingScore.divide(BigDecimal.valueOf(10), 2, RoundingMode.HALF_UP);
        }
        boolean passed = score.compareTo(paperPassingScore) >= 0;
        attempt.setPassed(passed);
        attempt.setClassification(classificationService.classifyOverall(score));
        attempt.setTimeSpentSeconds(Math.toIntExact(Math.max(0, Duration.between(attempt.getStartedAt(), submittedAt).toSeconds())));
        ExamAttempt saved = attemptRepository.save(attempt);

        if (passed) {
            eventPublisher.publishEvent(new ExamAttemptPassedEvent(saved));
        }

        return saved;
    }

    private void upsertAnswers(ExamAttempt attempt, SaveExamAttemptAnswersRequest request) {
        if (request == null || request.answers() == null) {
            return;
        }
        Map<Long, ExamPaperQuestion> questionsById = questionsForAttempt(attempt).stream()
                .collect(Collectors.toMap(ExamPaperQuestion::getId, Function.identity()));
        for (SaveExamAttemptAnswersRequest.Answer submittedAnswer : request.answers()) {
            if (submittedAnswer == null || submittedAnswer.paperQuestionId() == null) {
                continue;
            }
            ExamPaperQuestion question = questionsById.get(submittedAnswer.paperQuestionId());
            if (question == null) {
                throw new BadRequestException("Câu hỏi không thuộc lượt làm bài này");
            }
            String selectedAnswer = normalizeAnswer(submittedAnswer.selectedAnswer());
            if (submittedAnswer.selectedAnswer() != null && selectedAnswer == null) {
                throw new BadRequestException("Đáp án đã chọn không hợp lệ");
            }
            ExamAttemptAnswer answer = answerRepository.findByAttemptAndPaperQuestion(attempt, question)
                    .orElseGet(() -> ExamAttemptAnswer.builder()
                            .attempt(attempt)
                            .paperQuestion(question)
                            .build());
            answer.setSelectedAnswer(selectedAnswer);
            answerRepository.save(answer);
        }
    }

    private ExamAttemptResponse toResponse(
            ExamAttempt attempt,
            boolean includeQuestions,
            boolean revealAnswers,
            boolean revealScore
    ) {
        Instant serverNow = Instant.now(clock);
        Instant expiresAt = toInstant(attempt.getExpiresAt());
        Long remainingSeconds = expiresAt == null
                ? null
                : Math.max(0L, Duration.between(serverNow, expiresAt).getSeconds());
        Map<Long, ExamAttemptAnswer> answersByQuestionId = includeQuestions || revealAnswers
                ? answerRepository.findByAttemptOrderByPaperQuestionPositionAsc(attempt).stream()
                .collect(Collectors.toMap(answer -> answer.getPaperQuestion().getId(), Function.identity(), (left, right) -> left, LinkedHashMap::new))
                : Map.of();
        List<ExamPaperQuestion> presentedQuestions = includeQuestions || revealAnswers
                ? presentedQuestions(attempt)
                : List.of();
        List<ExamAttemptQuestionResponse> questions = includeQuestions
                ? toQuestionResponses(attempt, presentedQuestions, answersByQuestionId)
                : List.of();
        List<ExamAttemptAnswerResponse> answers = revealAnswers
                ? toAnswerResponses(attempt, presentedQuestions, answersByQuestionId)
                : List.of();
        return new ExamAttemptResponse(
                attempt.getId(),
                attempt.getAssignment().getId(),
                attempt.getAssignment().getName(),
                attempt.getExamPaper().getId(),
                  attempt.getExamPaper().getCode(),
                  attempt.getExamPaper().getName(),
                  attempt.getAssignment().getProfessionalField() == null ? null : attempt.getAssignment().getProfessionalField().getId(),
                  attempt.getAssignment().getProfessionalField() == null ? null : attempt.getAssignment().getProfessionalField().getCode(),
                  attempt.getAssignment().getProfessionalField() == null ? null : attempt.getAssignment().getProfessionalField().getName(),
                  attempt.getUser().getId(),
                attempt.getUser().getEmployeeCode(),
                attempt.getUser().getName(),
                attempt.getAttemptNumber(),
                attempt.getStatus().name(),
                QuestionGenerationLabels.examAttemptStatus(attempt.getStatus()),
                toInstant(attempt.getStartedAt()),
                toInstant(attempt.getSubmittedAt()),
                expiresAt,
                remainingSeconds,
                serverNow,
                revealScore ? attempt.getScore() : null,
                revealScore ? attempt.getCorrectCount() : null,
                attempt.getTotalQuestions(),
                revealScore ? attempt.getPassed() : null,
                revealScore && attempt.getClassification() != null ? attempt.getClassification().name() : null,
                revealScore && attempt.getClassification() != null ? QuestionGenerationLabels.competencyLevel(attempt.getClassification()) : null,
                attempt.getTimeSpentSeconds(),
                questions,
                answers
        );
    }

    private List<ExamAttemptQuestionResponse> toQuestionResponses(
            ExamAttempt attempt,
            List<ExamPaperQuestion> questions,
            Map<Long, ExamAttemptAnswer> answersByQuestionId
    ) {
        List<ExamAttemptQuestionResponse> responses = new ArrayList<>();
        for (int index = 0; index < questions.size(); index++) {
            ExamPaperQuestion question = questions.get(index);
            ExamPaperQuestionSnapshot snapshot = snapshot(question);
            OptionPresentation options = optionPresentation(attempt, question, snapshot);
            ExamAttemptAnswer answer = answersByQuestionId.get(question.getId());
            responses.add(new ExamAttemptQuestionResponse(
                    question.getId(),
                    index + 1,
                    snapshot.getStem(),
                    options.optionA(),
                    options.optionB(),
                    options.optionC(),
                    options.optionD(),
                    answer == null ? null : answer.getSelectedAnswer()
            ));
        }
        return responses;
    }

    private List<ExamAttemptAnswerResponse> toAnswerResponses(
            ExamAttempt attempt,
            List<ExamPaperQuestion> questions,
            Map<Long, ExamAttemptAnswer> answersByQuestionId
    ) {
        List<ExamAttemptAnswerResponse> responses = new ArrayList<>();
        for (int index = 0; index < questions.size(); index++) {
            ExamPaperQuestion question = questions.get(index);
            ExamPaperQuestionSnapshot snapshot = snapshot(question);
            OptionPresentation options = optionPresentation(attempt, question, snapshot);
            ExamAttemptAnswer answer = answersByQuestionId.get(question.getId());
            responses.add(new ExamAttemptAnswerResponse(
                    question.getId(),
                    index + 1,
                    answer == null ? null : answer.getSelectedAnswer(),
                    answer != null && Boolean.TRUE.equals(answer.getCorrect()),
                    options.correctAnswer(),
                    snapshot.getExplanation()
            ));
        }
        return responses;
    }

    private List<ExamPaperQuestion> presentedQuestions(ExamAttempt attempt) {
        List<ExamAttemptQuestion> selections = attemptQuestionRepository.findByAttemptOrderByPositionAsc(attempt);
        if (!selections.isEmpty()) {
            return selections.stream().map(ExamAttemptQuestion::getPaperQuestion).toList();
        }
        List<ExamPaperQuestion> questions = new ArrayList<>(questionsForAttempt(attempt));
        ExamAssignment assignment = attempt.getAssignment();
        if (attempt.getPresentationSeed() == null
                || assignment == null
                || !Boolean.TRUE.equals(assignment.getShuffleQuestions())
                || questions.size() < 2) {
            return questions;
        }
        Collections.shuffle(questions, new Random(mixSeed(attempt.getPresentationSeed(), attempt.getExamPaper().getId())));
        return questions;
    }

    private void initializeAttemptQuestions(ExamAttempt attempt) {
        if (selectionMode(attempt) != ExamQuestionSelectionMode.PER_ATTEMPT_BALANCED
                || !attemptQuestionRepository.findByAttemptOrderByPositionAsc(attempt).isEmpty()) {
            return;
        }
        List<ExamPaperQuestion> pool = paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper());
        ExamDifficultyAllocator.Percentages percentages = ExamDifficultyAllocator.percentages(
                attempt.getExamPaper().getEasyPercentage(),
                attempt.getExamPaper().getMediumPercentage(),
                attempt.getExamPaper().getHardPercentage()
        );
        ExamDifficultyAllocator.Counts required = ExamDifficultyAllocator.allocate(
                attempt.getExamPaper().getTotalQuestions(),
                percentages
        );
        Set<Long> seenIds = Set.copyOf(attemptQuestionRepository.findPreviouslySeenQuestionIds(
                attempt.getAssignment(),
                attempt.getUser(),
                attempt.getAttemptNumber()
        ));
        Map<String, List<ExamPaperQuestion>> byDifficulty = pool.stream()
                .collect(Collectors.groupingBy(question ->
                        ExamDifficultyAllocator.normalizeDifficulty(snapshot(question).getDifficulty())));
        List<ExamPaperQuestion> selected = new ArrayList<>();
        selectDifficultyBucket(selected, byDifficulty.getOrDefault("EASY", List.of()), required.easy(), seenIds,
                mixSeed(attempt.getPresentationSeed(), 101L));
        selectDifficultyBucket(selected, byDifficulty.getOrDefault("MEDIUM", List.of()), required.medium(), seenIds,
                mixSeed(attempt.getPresentationSeed(), 211L));
        selectDifficultyBucket(selected, byDifficulty.getOrDefault("HARD", List.of()), required.hard(), seenIds,
                mixSeed(attempt.getPresentationSeed(), 307L));
        if (selected.size() != attempt.getExamPaper().getTotalQuestions()) {
            throw new BadRequestException("Bộ câu hỏi không còn đủ câu theo tỷ lệ độ khó đã cấu hình");
        }
        if (Boolean.TRUE.equals(attempt.getAssignment().getShuffleQuestions())) {
            Collections.shuffle(selected, new Random(mixSeed(attempt.getPresentationSeed(), attempt.getExamPaper().getId())));
        } else {
            selected.sort(java.util.Comparator.comparing(ExamPaperQuestion::getPosition));
        }
        for (int index = 0; index < selected.size(); index++) {
            attemptQuestionRepository.save(ExamAttemptQuestion.builder()
                    .attempt(attempt)
                    .paperQuestion(selected.get(index))
                    .position(index + 1)
                    .build());
        }
    }

    private void selectDifficultyBucket(
            List<ExamPaperQuestion> selected,
            List<ExamPaperQuestion> candidates,
            int required,
            Set<Long> seenIds,
            long seed
    ) {
        if (required == 0) {
            return;
        }
        List<ExamPaperQuestion> unseen = candidates.stream()
                .filter(question -> !seenIds.contains(question.getId()))
                .collect(Collectors.toCollection(ArrayList::new));
        List<ExamPaperQuestion> seen = candidates.stream()
                .filter(question -> seenIds.contains(question.getId()))
                .collect(Collectors.toCollection(ArrayList::new));
        Collections.shuffle(unseen, new Random(seed));
        Collections.shuffle(seen, new Random(mixSeed(seed, 401L)));
        unseen.stream().limit(required).forEach(selected::add);
        if (unseen.size() < required) {
            seen.stream().limit(required - unseen.size()).forEach(selected::add);
        }
    }

    private List<ExamPaperQuestion> questionsForAttempt(ExamAttempt attempt) {
        List<ExamAttemptQuestion> selections = attemptQuestionRepository.findByAttemptOrderByPositionAsc(attempt);
        if (!selections.isEmpty()) {
            return selections.stream().map(ExamAttemptQuestion::getPaperQuestion).toList();
        }
        return paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper());
    }

    private ExamQuestionSelectionMode selectionMode(ExamAttempt attempt) {
        return attempt.getExamPaper().getQuestionSelectionMode() == null
                ? ExamQuestionSelectionMode.FIXED_PAPER
                : attempt.getExamPaper().getQuestionSelectionMode();
    }

    private OptionPresentation optionPresentation(
            ExamAttempt attempt,
            ExamPaperQuestion question,
            ExamPaperQuestionSnapshot snapshot
    ) {
        List<OptionChoice> choices = new ArrayList<>(List.of(
                new OptionChoice("A", snapshot.getOptionA()),
                new OptionChoice("B", snapshot.getOptionB()),
                new OptionChoice("C", snapshot.getOptionC()),
                new OptionChoice("D", snapshot.getOptionD())
        ));
        ExamAssignment assignment = attempt.getAssignment();
        if (attempt.getPresentationSeed() != null
                && assignment != null
                && Boolean.TRUE.equals(assignment.getShuffleOptions())) {
            Collections.shuffle(choices, new Random(mixSeed(attempt.getPresentationSeed(), question.getId())));
            if (isOriginalOptionOrder(choices)) {
                Collections.rotate(choices, 1);
            }
        }
        String sourceCorrectAnswer = normalizeAnswer(snapshot.getCorrectAnswer());
        String displayedCorrectAnswer = sourceCorrectAnswer;
        List<String> displayedLabels = List.of("A", "B", "C", "D");
        for (int index = 0; index < choices.size(); index++) {
            if (choices.get(index).sourceLabel().equals(sourceCorrectAnswer)) {
                displayedCorrectAnswer = displayedLabels.get(index);
                break;
            }
        }
        return new OptionPresentation(
                choices.get(0).text(),
                choices.get(1).text(),
                choices.get(2).text(),
                choices.get(3).text(),
                displayedCorrectAnswer
        );
    }

    private ExamPaperQuestionSnapshot snapshot(ExamPaperQuestion question) {
        return snapshotRepository.findByExamPaperQuestion(question)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
    }

    private boolean isOriginalOptionOrder(List<OptionChoice> choices) {
        return choices.size() == 4
                && "A".equals(choices.get(0).sourceLabel())
                && "B".equals(choices.get(1).sourceLabel())
                && "C".equals(choices.get(2).sourceLabel())
                && "D".equals(choices.get(3).sourceLabel());
    }

    private long mixSeed(long seed, Long discriminator) {
        long value = seed ^ (discriminator == null ? 0L : discriminator * 0x9E3779B97F4A7C15L);
        value ^= value >>> 30;
        value *= 0xBF58476D1CE4E5B9L;
        value ^= value >>> 27;
        value *= 0x94D049BB133111EBL;
        return value ^ (value >>> 31);
    }

    private void validateStartableAssignment(ExamAssignment assignment, User user) {
        LocalDateTime now = now();
        if (assignment.getStatus() != ExamAssignmentStatus.OPEN) {
            throw new BadRequestException("Phân công kiểm tra chưa mở");
        }
        if (assignment.getAvailableFrom() != null && now.isBefore(assignment.getAvailableFrom())) {
            throw new BadRequestException("Chưa đến thời gian bắt đầu bài kiểm tra");
        }
        if (assignment.getDueAt() != null && now.isAfter(assignment.getDueAt())) {
            throw new BadRequestException("Phân công kiểm tra đã quá hạn");
        }
        if (assignment.getExamPaper().getStatus() != ExamPaperStatus.PUBLISHED) {
            throw new BadRequestException("Bộ đề kiểm tra chưa phát hành");
        }
        targetRepository.findByAssignmentAndUserForUpdate(assignment, user)
                .orElseThrow(() -> new BadRequestException("Bạn không nằm trong danh sách được phân công"));
    }

    private void ensureInProgress(ExamAttempt attempt) {
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) {
            throw new BadRequestException("Lượt làm bài không còn ở trạng thái đang làm");
        }
    }

    private boolean isExpired(ExamAttempt attempt) {
        return attempt.getExpiresAt() != null && now().isAfter(attempt.getExpiresAt());
    }

    private void expireIfNeeded(ExamAttempt attempt) {
        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS && isExpired(attempt)) {
            gradeAttempt(attempt, null, effectiveExpiry(attempt));
        }
    }

    private LocalDateTime effectiveExpiry(ExamAttempt attempt) {
        return attempt.getExpiresAt() == null ? now() : attempt.getExpiresAt();
    }

    private boolean canRevealAnswers(ExamAttempt attempt) {
        if (resultVisibility(attempt) != ExamResultVisibility.SCORE_AND_ANSWERS) {
            return false;
        }
        if (attempt.getStatus() != ExamAttemptStatus.SUBMITTED && attempt.getStatus() != ExamAttemptStatus.GRADED) {
            return false;
        }
        return assignmentService.isAssignmentEnded(attempt.getAssignment(), now());
    }

    private boolean canRevealScore(ExamAttempt attempt) {
        return resultVisibility(attempt) == ExamResultVisibility.SCORE_ONLY
                || assignmentService.isAssignmentEnded(attempt.getAssignment(), now());
    }

    private boolean canRevealQuestionReview(ExamAttempt attempt) {
        return attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS || canRevealScore(attempt);
    }

    private ExamResultVisibility resultVisibility(ExamAttempt attempt) {
        ExamAssignment assignment = attempt.getAssignment();
        if (assignment == null || assignment.getResultVisibility() == null) {
            return ExamResultVisibility.SCORE_ONLY;
        }
        return assignment.getResultVisibility();
    }

    private void requireOwner(ExamAttempt attempt, Long userId) {
        if (!attempt.getUser().getId().equals(userId)) {
            throw new BadRequestException("Bạn không có quyền truy cập lượt làm bài này");
        }
    }

    private ExamAttempt find(Long attemptId) {
        return attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lượt làm bài"));
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy nhân viên"));
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock.withZone(examBusinessZone));
    }

    private Instant toInstant(LocalDateTime value) {
        return value == null ? null : value.atZone(examBusinessZone).toInstant();
    }

    private ExamAttemptStatus parseStatusOrNull(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return ExamAttemptStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (Exception ex) {
            throw new BadRequestException("Trạng thái lượt làm bài không hợp lệ");
        }
    }

    private String normalizeAnswer(String answer) {
        if (answer == null || answer.isBlank()) {
            return null;
        }
        String normalized = answer.trim().toUpperCase(Locale.ROOT);
        return VALID_ANSWERS.contains(normalized) ? normalized : null;
    }

    private record OptionChoice(String sourceLabel, String text) {
    }

    private record OptionPresentation(
            String optionA,
            String optionB,
            String optionC,
            String optionD,
            String correctAnswer
    ) {
    }
}
