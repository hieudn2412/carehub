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
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamPaperStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamResultVisibility;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamAttemptService {
    private static final Set<String> VALID_ANSWERS = Set.of("A", "B", "C", "D");

    private final ExamAssignmentService assignmentService;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAttemptAnswerRepository answerRepository;
    private final ExamAssignmentTargetRepository targetRepository;
    private final ExamPaperQuestionRepository paperQuestionRepository;
    private final ExamPaperQuestionSnapshotRepository snapshotRepository;
    private final UserRepository userRepository;
    private final CompetencyClassificationService classificationService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public List<ExamAttemptResponse> listAdmin(Long assignmentId, String status) {
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
                .map(attempt -> toResponse(attempt, false, true))
                .toList();
    }

    @Transactional
    public ExamAttemptResponse getAdmin(Long attemptId) {
        ExamAttempt attempt = find(attemptId);
        expireIfNeeded(attempt);
        return toResponse(attempt, true, true);
    }

    @Transactional
    public List<ExamAttemptResponse> listForUser(Long userId) {
        User user = findUser(userId);
        return attemptRepository.findByUserOrderByStartedAtDesc(user).stream()
                .peek(this::expireIfNeeded)
                .map(attempt -> toResponse(attempt, false, canRevealAnswers(attempt)))
                .toList();
    }

    @Transactional
    public ExamAttemptResponse getForUser(Long attemptId, Long userId) {
        ExamAttempt attempt = find(attemptId);
        requireOwner(attempt, userId);
        expireIfNeeded(attempt);
        return toResponse(attempt, true, canRevealAnswers(attempt));
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
                    existingAttempt.setStatus(ExamAttemptStatus.EXPIRED);
                    attemptRepository.save(existingAttempt);
                } else {
                    return toResponse(existingAttempt, true, false);
                }
            }
        }
        long attemptCount = attemptRepository.countByAssignmentAndUser(assignment, user);
        if (attemptCount >= assignment.getMaxAttempts()) {
            throw new BadRequestException("Bạn đã dùng hết số lượt làm bài");
        }

        LocalDateTime now = LocalDateTime.now();
        ExamAttempt attempt = attemptRepository.save(ExamAttempt.builder()
                .assignment(assignment)
                .examPaper(assignment.getExamPaper())
                .user(user)
                .attemptNumber((int) attemptCount + 1)
                .status(ExamAttemptStatus.IN_PROGRESS)
                .startedAt(now)
                .expiresAt(now.plusMinutes(assignment.getExamPaper().getTimeLimitMinutes()))
                .totalQuestions(assignment.getExamPaper().getTotalQuestions())
                .build());
        return toResponse(attempt, true, false);
    }

    @Transactional
    public ExamAttemptResponse saveAnswers(Long attemptId, Long userId, SaveExamAttemptAnswersRequest request) {
        ExamAttempt attempt = find(attemptId);
        requireOwner(attempt, userId);
        ensureWritable(attempt);
        upsertAnswers(attempt, request);
        return toResponse(attempt, true, false);
    }

    @Transactional
    public ExamAttemptResponse submit(Long attemptId, Long userId, SaveExamAttemptAnswersRequest request) {
        ExamAttempt attempt = find(attemptId);
        requireOwner(attempt, userId);
        ensureWritable(attempt);
        upsertAnswers(attempt, request);

        List<ExamPaperQuestion> questions = paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper());
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
            boolean correct = normalizeAnswer(answer.getSelectedAnswer()) != null
                    && normalizeAnswer(answer.getSelectedAnswer()).equals(normalizeAnswer(snapshot.getCorrectAnswer()));
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
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalQuestions), 2, RoundingMode.HALF_UP);
        LocalDateTime submittedAt = LocalDateTime.now();
        attempt.setStatus(ExamAttemptStatus.GRADED);
        attempt.setSubmittedAt(submittedAt);
        attempt.setCorrectCount(correctCount);
        attempt.setTotalQuestions(totalQuestions);
        attempt.setScore(score);
        boolean passed = score.compareTo(BigDecimal.valueOf(attempt.getExamPaper().getPassingScore())) >= 0;
        attempt.setPassed(passed);
        attempt.setClassification(classificationService.classifyOverall(score));
        attempt.setTimeSpentSeconds(Math.toIntExact(Math.max(0, Duration.between(attempt.getStartedAt(), submittedAt).toSeconds())));
        ExamAttempt saved = attemptRepository.save(attempt);

        if (passed) {
            eventPublisher.publishEvent(new ExamAttemptPassedEvent(saved));
        }

        return toResponse(saved, true, canRevealAnswers(saved));
    }

    private void upsertAnswers(ExamAttempt attempt, SaveExamAttemptAnswersRequest request) {
        if (request == null || request.answers() == null) {
            return;
        }
        Map<Long, ExamPaperQuestion> questionsById = paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper()).stream()
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

    private ExamAttemptResponse toResponse(ExamAttempt attempt, boolean includeQuestions, boolean revealAnswers) {
        Map<Long, ExamAttemptAnswer> answersByQuestionId = answerRepository.findByAttemptOrderByPaperQuestionPositionAsc(attempt).stream()
                .collect(Collectors.toMap(answer -> answer.getPaperQuestion().getId(), Function.identity(), (left, right) -> left, LinkedHashMap::new));
        List<ExamAttemptQuestionResponse> questions = includeQuestions
                ? paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper()).stream()
                .map(question -> toQuestionResponse(question, answersByQuestionId.get(question.getId())))
                .toList()
                : List.of();
        List<ExamAttemptAnswerResponse> answers = revealAnswers
                ? paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper()).stream()
                .sorted(Comparator.comparing(ExamPaperQuestion::getPosition))
                .map(question -> toAnswerResponse(question, answersByQuestionId.get(question.getId())))
                .toList()
                : List.of();
        return new ExamAttemptResponse(
                attempt.getId(),
                attempt.getAssignment().getId(),
                attempt.getAssignment().getName(),
                attempt.getExamPaper().getId(),
                attempt.getExamPaper().getCode(),
                attempt.getExamPaper().getName(),
                attempt.getUser().getId(),
                attempt.getUser().getEmployeeCode(),
                attempt.getUser().getName(),
                attempt.getAttemptNumber(),
                attempt.getStatus().name(),
                QuestionGenerationLabels.examAttemptStatus(attempt.getStatus()),
                attempt.getStartedAt(),
                attempt.getSubmittedAt(),
                attempt.getExpiresAt(),
                attempt.getScore(),
                attempt.getCorrectCount(),
                attempt.getTotalQuestions(),
                attempt.getPassed(),
                attempt.getClassification() == null ? null : attempt.getClassification().name(),
                attempt.getClassification() == null ? null : QuestionGenerationLabels.competencyLevel(attempt.getClassification()),
                attempt.getTimeSpentSeconds(),
                questions,
                answers
        );
    }

    private ExamAttemptQuestionResponse toQuestionResponse(ExamPaperQuestion question, ExamAttemptAnswer answer) {
        ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(question)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
        return new ExamAttemptQuestionResponse(
                question.getId(),
                question.getPosition(),
                snapshot.getStem(),
                snapshot.getOptionA(),
                snapshot.getOptionB(),
                snapshot.getOptionC(),
                snapshot.getOptionD(),
                answer == null ? null : answer.getSelectedAnswer()
        );
    }

    private ExamAttemptAnswerResponse toAnswerResponse(ExamPaperQuestion question, ExamAttemptAnswer answer) {
        ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(question)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy snapshot câu hỏi trong đề"));
        return new ExamAttemptAnswerResponse(
                question.getId(),
                question.getPosition(),
                answer == null ? null : answer.getSelectedAnswer(),
                answer == null ? false : Boolean.TRUE.equals(answer.getCorrect()),
                snapshot.getCorrectAnswer(),
                snapshot.getExplanation()
        );
    }

    private void validateStartableAssignment(ExamAssignment assignment, User user) {
        if (assignment.getStatus() != ExamAssignmentStatus.OPEN) {
            throw new BadRequestException("Phân công kiểm tra chưa mở");
        }
        if (assignment.getDueAt() != null && LocalDateTime.now().isAfter(assignment.getDueAt())) {
            throw new BadRequestException("Phân công kiểm tra đã quá hạn");
        }
        if (assignment.getExamPaper().getStatus() != ExamPaperStatus.PUBLISHED) {
            throw new BadRequestException("Bộ đề kiểm tra chưa phát hành");
        }
        targetRepository.findByAssignmentAndUser(assignment, user)
                .orElseThrow(() -> new BadRequestException("Bạn không nằm trong danh sách được phân công"));
    }

    private void ensureWritable(ExamAttempt attempt) {
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) {
            throw new BadRequestException("Lượt làm bài không còn ở trạng thái đang làm");
        }
        if (isExpired(attempt)) {
            attempt.setStatus(ExamAttemptStatus.EXPIRED);
            attemptRepository.save(attempt);
            throw new BadRequestException("Lượt làm bài đã quá thời gian");
        }
    }

    private boolean isExpired(ExamAttempt attempt) {
        return attempt.getExpiresAt() != null && LocalDateTime.now().isAfter(attempt.getExpiresAt());
    }

    private void expireIfNeeded(ExamAttempt attempt) {
        if (attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS && isExpired(attempt)) {
            attempt.setStatus(ExamAttemptStatus.EXPIRED);
            attemptRepository.save(attempt);
        }
    }

    private boolean canRevealAnswers(ExamAttempt attempt) {
        return resultVisibility(attempt) == ExamResultVisibility.SCORE_AND_ANSWERS
                && (attempt.getStatus() == ExamAttemptStatus.SUBMITTED || attempt.getStatus() == ExamAttemptStatus.GRADED);
    }

    private ExamResultVisibility resultVisibility(ExamAttempt attempt) {
        return attempt.getAssignment().getResultVisibility() == null
                ? ExamResultVisibility.SCORE_ONLY
                : attempt.getAssignment().getResultVisibility();
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
}
