package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DiscriminationIndexResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDistributionItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionBankSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionItemAnalysisResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.WrongAnswerDistributionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.request.EvaluationResultFilter;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignmentTarget;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAssignment;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaper;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAssignmentStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAssignmentTargetRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.QuestionItemAnalysisProjection;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EvaluationDashboardService {
    private static final int TOP_DISTRIBUTION_LIMIT = 12;
    private static final int TOP_ITEM_ANALYSIS_LIMIT = 50;

    private final QuestionBankQuestionRepository questionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAttemptAnswerRepository answerRepository;
    private final ExamPaperQuestionSnapshotRepository snapshotRepository;
    private final ExamAssignmentTargetRepository assignmentTargetRepository;

    @Transactional(readOnly = true)
    public EvaluationDashboardResponse dashboard() {
        return dashboard(null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public EvaluationDashboardResponse dashboard(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId, Long professionalFieldId) {
        return new EvaluationDashboardResponse(
                questionBankSummary(),
                examResultsSummary(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId, professionalFieldId),
                itemAnalysis(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId, professionalFieldId)
        );
    }

    @Transactional(readOnly = true)
    public EvaluationQuestionBankSummaryResponse questionBankSummary() {
        long total = questionRepository.count();
        return new EvaluationQuestionBankSummaryResponse(
                total,
                questionRepository.countByStatus(QuestionBankStatus.APPROVED),
                questionRepository.countByStatus(QuestionBankStatus.DRAFT),
                questionRepository.countByStatus(QuestionBankStatus.REJECTED),
                questionRepository.countByStatus(QuestionBankStatus.ARCHIVED),
                questionRepository.countByQuestionType(QuestionType.ORIGINAL),
                questionRepository.countByQuestionType(QuestionType.PARAPHRASE),
                toDistribution(questionRepository.countGroupByStatus(), TOP_DISTRIBUTION_LIMIT),
                toDistribution(questionRepository.countGroupByDifficulty(), TOP_DISTRIBUTION_LIMIT),
                toDistribution(questionRepository.countGroupByTopic(), TOP_DISTRIBUTION_LIMIT),
                toDistribution(questionRepository.countGroupBySourceDocument(), TOP_DISTRIBUTION_LIMIT)
        );
    }

    @Transactional(readOnly = true)
    public EvaluationExamResultsSummaryResponse examResultsSummary() {
        return examResultsSummary(null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public EvaluationExamResultsSummaryResponse examResultsSummary(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId, Long professionalFieldId) {
        List<ExamAttempt> attempts = filterAttempts(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId, professionalFieldId);
        return summarizeAttempts(attempts);
    }

    @Transactional(readOnly = true)
    public EvaluationExamDashboardResponse examOverview(
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Long paperId,
            Long assignmentId,
            Long departmentId,
            Long professionalFieldId,
            Long employeeId,
            EvaluationResultFilter resultFilter
    ) {
        List<ExamAssignmentTarget> allTargets = assignmentTargetRepository.findAllForDashboard();
        List<ExamAssignmentTarget> targets = filterTargets(
                allTargets,
                departmentId,
                paperId,
                assignmentId,
                professionalFieldId,
                employeeId
        );
        List<ExamAssignmentTarget> employeeOptionTargets = filterTargets(
                allTargets,
                departmentId,
                null,
                null,
                null,
                null
        );
        List<ExamAttempt> allAttempts = attemptRepository.findAllByOrderByStartedAtDesc();
        Set<String> startedTargetKeys = allAttempts.stream()
                .map(attempt -> targetKey(attempt.getAssignment(), attempt.getUser().getId()))
                .collect(Collectors.toSet());
        List<ExamAttempt> attempts = filterAttempts(
                allAttempts,
                fromDate,
                toDate,
                null,
                paperId,
                assignmentId,
                departmentId,
                professionalFieldId
        ).stream()
                .filter(attempt -> employeeId == null || attempt.getUser().getId().equals(employeeId))
                .filter(attempt -> matchesResult(attempt, resultFilter))
                .toList();

        Map<Long, List<ExamAssignmentTarget>> targetsByField = new LinkedHashMap<>();
        targets.forEach(target -> targetsByField
                .computeIfAbsent(professionalFieldId(target.getAssignment()), ignored -> new ArrayList<>())
                .add(target));
        List<EvaluationExamDashboardResponse.ProfessionalFieldItem> byProfessionalField =
                targetsByField.values().stream()
                        .map(fieldTargets -> professionalFieldItem(
                                fieldTargets,
                                attempts,
                                startedTargetKeys
                        ))
                        .sorted(Comparator.comparing(
                                EvaluationExamDashboardResponse.ProfessionalFieldItem::professionalFieldName,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                        ))
                        .toList();

        Map<Long, List<ExamAssignmentTarget>> targetsByPaper = new LinkedHashMap<>();
        targets.forEach(target -> targetsByPaper
                .computeIfAbsent(target.getAssignment().getExamPaper().getId(), ignored -> new ArrayList<>())
                .add(target));
        List<EvaluationExamDashboardResponse.PaperItem> byPaper = targetsByPaper.values().stream()
                .map(paperTargets -> paperItem(paperTargets, attempts, startedTargetKeys))
                .sorted(Comparator.comparing(
                        EvaluationExamDashboardResponse.PaperItem::paperName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();

        Map<Long, EvaluationExamDashboardResponse.EmployeeOption> employeeOptions = new LinkedHashMap<>();
        employeeOptionTargets.forEach(target -> employeeOptions.putIfAbsent(
                target.getUser().getId(),
                new EvaluationExamDashboardResponse.EmployeeOption(
                        target.getUser().getId(),
                        target.getUser().getEmployeeCode(),
                        target.getUser().getName()
                )
        ));
        List<EvaluationExamDashboardResponse.EmployeeOption> employees = employeeOptions.values().stream()
                .sorted(Comparator.comparing(
                        EvaluationExamDashboardResponse.EmployeeOption::name,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();

        return new EvaluationExamDashboardResponse(
                LocalDateTime.now(),
                targets.stream().map(target -> target.getAssignment().getId()).distinct().count(),
                targets.size(),
                notStartedCount(targets, startedTargetKeys),
                summarizeAttempts(attempts),
                byProfessionalField,
                byPaper,
                employees
        );
    }

    private EvaluationExamResultsSummaryResponse summarizeAttempts(List<ExamAttempt> attempts) {
        long total = attempts.size();
        long graded = attempts.stream()
                .filter(attempt -> attempt.getStatus() == ExamAttemptStatus.GRADED || attempt.getStatus() == ExamAttemptStatus.SUBMITTED)
                .count();
        long passed = attempts.stream().filter(attempt -> Boolean.TRUE.equals(attempt.getPassed())).count();
        long failed = attempts.stream()
                .filter(attempt -> (attempt.getStatus() == ExamAttemptStatus.GRADED || attempt.getStatus() == ExamAttemptStatus.SUBMITTED)
                        && !Boolean.TRUE.equals(attempt.getPassed()))
                .count();
        BigDecimal averageScore = attempts.stream()
                .filter(attempt -> attempt.getScore() != null)
                .map(ExamAttempt::getScore)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long scoredCount = attempts.stream().filter(attempt -> attempt.getScore() != null).count();
        if (scoredCount > 0) {
            averageScore = averageScore.divide(BigDecimal.valueOf(scoredCount), 2, RoundingMode.HALF_UP);
        }
        int averageTimeSpent = (int) Math.round(attempts.stream()
                .filter(attempt -> attempt.getTimeSpentSeconds() != null)
                .mapToInt(ExamAttempt::getTimeSpentSeconds)
                .average()
                .orElse(0));
        double passRate = graded == 0 ? 0 : (double) passed / graded;
        long inProgress = attempts.stream().filter(attempt -> attempt.getStatus() == ExamAttemptStatus.IN_PROGRESS).count();
        long expired = attempts.stream().filter(attempt -> attempt.getStatus() == ExamAttemptStatus.EXPIRED).count();
        List<EvaluationDistributionItemResponse> byStatus = Arrays.stream(ExamAttemptStatus.values())
                .map(status -> new EvaluationDistributionItemResponse(
                        status.name(), label(status.name()),
                        attempts.stream().filter(attempt -> attempt.getStatus() == status).count()))
                .filter(item -> item.count() > 0)
                .toList();

        return new EvaluationExamResultsSummaryResponse(
                total,
                inProgress,
                graded,
                expired,
                passed,
                failed,
                averageScore,
                passRate,
                averageTimeSpent,
                byStatus
        );
    }

    @Transactional(readOnly = true)
    public List<EvaluationQuestionItemAnalysisResponse> itemAnalysis() {
        return itemAnalysis(null, null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<EvaluationQuestionItemAnalysisResponse> itemAnalysis(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId, Long professionalFieldId) {
        List<ExamAttempt> filteredAttempts = filterAttempts(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId, professionalFieldId);
        Set<Long> filteredAttemptIds = filteredAttempts.stream().map(ExamAttempt::getId).collect(Collectors.toSet());

        return answerRepository.analyzeQuestionItems(List.of(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED)).stream()
                .filter(row -> filteredAttemptIds.isEmpty() || true) // Allow all, limit for now
                .limit(TOP_ITEM_ANALYSIS_LIMIT)
                .map(this::toItemAnalysis)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DiscriminationIndexResponse> discriminationIndex(
            Long paperId, Long assignmentId) {
        List<ExamAttempt> attempts = filterAttempts(null, null, null, paperId, assignmentId, null, null);
        List<ExamAttempt> graded = attempts.stream()
                .filter(a -> a.getScore() != null
                        && (a.getStatus() == ExamAttemptStatus.GRADED || a.getStatus() == ExamAttemptStatus.SUBMITTED))
                .toList();

        if (graded.size() < 4) {
            return List.of();
        }

        // Split into top 27% and bottom 27%
        graded.sort(Comparator.comparing(ExamAttempt::getScore));
        int groupSize = (int) Math.ceil(graded.size() * 0.27);
        List<ExamAttempt> lowGroup = graded.subList(0, groupSize);
        List<ExamAttempt> highGroup = graded.subList(graded.size() - groupSize, graded.size());

        Set<Long> lowAttemptIds = lowGroup.stream().map(ExamAttempt::getId).collect(Collectors.toSet());
        Set<Long> highAttemptIds = highGroup.stream().map(ExamAttempt::getId).collect(Collectors.toSet());

        List<QuestionItemAnalysisProjection> allItems = answerRepository.analyzeQuestionItems(
                List.of(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED));

        List<DiscriminationIndexResponse> results = new ArrayList<>();
        for (QuestionItemAnalysisProjection item : allItems) {
            long highCorrect = answerRepository.countByPaperQuestionQuestionIdAndAttemptIdInAndCorrectTrue(
                    item.getQuestionId(), highAttemptIds);
            long lowCorrect = answerRepository.countByPaperQuestionQuestionIdAndAttemptIdInAndCorrectTrue(
                    item.getQuestionId(), lowAttemptIds);
            long highTotal = highAttemptIds.size();
            long lowTotal = lowAttemptIds.size();

            if (highTotal == 0 || lowTotal == 0) continue;

            double highRate = (double) highCorrect / highTotal;
            double lowRate = (double) lowCorrect / lowTotal;
            double di = highRate - lowRate;
            String interpretation = interpretDiscrimination(di);

            results.add(new DiscriminationIndexResponse(
                    item.getQuestionId(), item.getStem(), item.getTopic(), item.getDifficulty(),
                    Math.round(di * 1000.0) / 1000.0, interpretation,
                    highCorrect, lowCorrect, highTotal, lowTotal));
        }

        results.sort((a, b) -> Double.compare(b.discriminationIndex(), a.discriminationIndex()));
        return results;
    }

    @Transactional(readOnly = true)
    public List<WrongAnswerDistributionResponse> wrongAnswerDistribution(Long paperId) {
        List<ExamAttempt> attempts = filterAttempts(null, null, null, paperId, null, null, null);
        Set<Long> attemptIds = attempts.stream()
                .filter(a -> a.getStatus() == ExamAttemptStatus.GRADED || a.getStatus() == ExamAttemptStatus.SUBMITTED)
                .map(ExamAttempt::getId)
                .collect(Collectors.toSet());

        if (attemptIds.isEmpty()) {
            return List.of();
        }

        // Use item analysis data which already has per-question info
        List<QuestionItemAnalysisProjection> items = answerRepository
                .analyzeQuestionItems(List.of(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED));
        List<WrongAnswerDistributionResponse> results = new ArrayList<>();

        for (QuestionItemAnalysisProjection item : items) {
            Long questionId = item.getQuestionId();
            Map<String, Long> optionCounts = new LinkedHashMap<>();
            optionCounts.put("A", answerRepository.countByPaperQuestionQuestionIdAndAttemptIdInAndSelectedAnswer(
                    questionId, attemptIds, "A"));
            optionCounts.put("B", answerRepository.countByPaperQuestionQuestionIdAndAttemptIdInAndSelectedAnswer(
                    questionId, attemptIds, "B"));
            optionCounts.put("C", answerRepository.countByPaperQuestionQuestionIdAndAttemptIdInAndSelectedAnswer(
                    questionId, attemptIds, "C"));
            optionCounts.put("D", answerRepository.countByPaperQuestionQuestionIdAndAttemptIdInAndSelectedAnswer(
                    questionId, attemptIds, "D"));

            long totalAnswers = optionCounts.values().stream().mapToLong(Long::longValue).sum();
            if (totalAnswers == 0) continue;

            // Get the correct answer from any snapshot for this question
            String correctAnswer = snapshotRepository.findAll().stream()
                    .filter(s -> s.getExamPaperQuestion() != null
                            && s.getExamPaperQuestion().getQuestion() != null
                            && s.getExamPaperQuestion().getQuestion().getId().equals(questionId))
                    .findFirst()
                    .map(ExamPaperQuestionSnapshot::getCorrectAnswer)
                    .orElse("?");

            List<WrongAnswerDistributionResponse.AnswerOptionCount> optionList = optionCounts.entrySet().stream()
                    .map(e -> new WrongAnswerDistributionResponse.AnswerOptionCount(
                            e.getKey(),
                            e.getValue(),
                            Math.round(e.getValue() * 10000.0 / totalAnswers) / 100.0))
                    .toList();

            results.add(new WrongAnswerDistributionResponse(
                    questionId, item.getStem(), correctAnswer, optionList));
        }
        return results;
    }

    private List<ExamAttempt> filterAttempts(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId, Long professionalFieldId) {
        return filterAttempts(
                attemptRepository.findAllByOrderByStartedAtDesc(),
                fromDate,
                toDate,
                examConfigId,
                paperId,
                assignmentId,
                departmentId,
                professionalFieldId
        );
    }

    private List<ExamAttempt> filterAttempts(
            List<ExamAttempt> attempts,
            LocalDateTime fromDate,
            LocalDateTime toDate,
            Long examConfigId,
            Long paperId,
            Long assignmentId,
            Long departmentId,
            Long professionalFieldId
    ) {
        return attempts.stream()
                .filter(a -> fromDate == null || (a.getStartedAt() != null && !a.getStartedAt().isBefore(fromDate)))
                .filter(a -> toDate == null || (a.getStartedAt() != null && !a.getStartedAt().isAfter(toDate)))
                .filter(a -> examConfigId == null || (a.getExamPaper() != null && a.getExamPaper().getExamConfig() != null
                        && a.getExamPaper().getExamConfig().getId().equals(examConfigId)))
                .filter(a -> paperId == null || (a.getExamPaper() != null && a.getExamPaper().getId().equals(paperId)))
                .filter(a -> assignmentId == null || (a.getAssignment() != null && a.getAssignment().getId().equals(assignmentId)))
                .filter(a -> departmentId == null || (a.getUser() != null && a.getUser().getDepartment() != null
                        && a.getUser().getDepartment().getId().equals(departmentId)))
                .filter(a -> professionalFieldId == null || (a.getAssignment() != null
                        && a.getAssignment().getProfessionalField() != null
                        && a.getAssignment().getProfessionalField().getId().equals(professionalFieldId)))
                .toList();
    }

    private List<ExamAssignmentTarget> filterTargets(
            List<ExamAssignmentTarget> targets,
            Long departmentId,
            Long paperId,
            Long assignmentId,
            Long professionalFieldId,
            Long employeeId
    ) {
        return targets.stream()
                .filter(target -> target.getAssignment().getStatus() != ExamAssignmentStatus.ARCHIVED)
                .filter(target -> departmentId == null
                        || (target.getUser().getDepartment() != null
                        && departmentId.equals(target.getUser().getDepartment().getId())))
                .filter(target -> paperId == null
                        || paperId.equals(target.getAssignment().getExamPaper().getId()))
                .filter(target -> assignmentId == null
                        || assignmentId.equals(target.getAssignment().getId()))
                .filter(target -> professionalFieldId == null
                        || professionalFieldId.equals(professionalFieldId(target.getAssignment())))
                .filter(target -> employeeId == null || employeeId.equals(target.getUser().getId()))
                .toList();
    }

    private EvaluationExamDashboardResponse.ProfessionalFieldItem professionalFieldItem(
            List<ExamAssignmentTarget> targets,
            List<ExamAttempt> attempts,
            Set<String> startedTargetKeys
    ) {
        ExamAssignment assignment = targets.get(0).getAssignment();
        List<ExamAttempt> scopedAttempts = attemptsForTargets(attempts, targets);
        EvaluationExamResultsSummaryResponse summary = summarizeAttempts(scopedAttempts);
        return new EvaluationExamDashboardResponse.ProfessionalFieldItem(
                professionalFieldId(assignment),
                assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getCode(),
                assignment.getProfessionalField() == null ? "Chưa xác định" : assignment.getProfessionalField().getName(),
                distinctAssignmentCount(targets),
                targets.size(),
                notStartedCount(targets, startedTargetKeys),
                summary.gradedAttempts(),
                summary.passedAttempts(),
                summary.failedAttempts(),
                summary.averageScore(),
                rate(summary.passRate())
        );
    }

    private EvaluationExamDashboardResponse.PaperItem paperItem(
            List<ExamAssignmentTarget> targets,
            List<ExamAttempt> attempts,
            Set<String> startedTargetKeys
    ) {
        ExamPaper paper = targets.get(0).getAssignment().getExamPaper();
        List<ExamAttempt> scopedAttempts = attemptsForTargets(attempts, targets);
        EvaluationExamResultsSummaryResponse summary = summarizeAttempts(scopedAttempts);
        List<String> fieldNames = targets.stream()
                .map(ExamAssignmentTarget::getAssignment)
                .map(ExamAssignment::getProfessionalField)
                .map(field -> field == null ? "Chưa xác định" : field.getName())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
        return new EvaluationExamDashboardResponse.PaperItem(
                paper.getId(),
                paper.getCode(),
                paper.getName(),
                paper.getVersion(),
                paper.getTotalQuestions(),
                paper.getPassingScore(),
                fieldNames,
                distinctAssignmentCount(targets),
                targets.size(),
                notStartedCount(targets, startedTargetKeys),
                summary.gradedAttempts(),
                summary.passedAttempts(),
                summary.failedAttempts(),
                summary.averageScore(),
                rate(summary.passRate())
        );
    }

    private List<ExamAttempt> attemptsForTargets(
            List<ExamAttempt> attempts,
            List<ExamAssignmentTarget> targets
    ) {
        Set<String> targetKeys = targets.stream()
                .map(target -> targetKey(target.getAssignment(), target.getUser().getId()))
                .collect(Collectors.toSet());
        return attempts.stream()
                .filter(attempt -> targetKeys.contains(targetKey(attempt.getAssignment(), attempt.getUser().getId())))
                .toList();
    }

    private long notStartedCount(
            List<ExamAssignmentTarget> targets,
            Set<String> startedTargetKeys
    ) {
        return targets.stream()
                .filter(target -> !startedTargetKeys.contains(targetKey(
                        target.getAssignment(),
                        target.getUser().getId()
                )))
                .count();
    }

    private long distinctAssignmentCount(List<ExamAssignmentTarget> targets) {
        return targets.stream().map(target -> target.getAssignment().getId()).distinct().count();
    }

    private Long professionalFieldId(ExamAssignment assignment) {
        return assignment.getProfessionalField() == null ? null : assignment.getProfessionalField().getId();
    }

    private String targetKey(ExamAssignment assignment, Long userId) {
        return assignment.getId() + ":" + userId;
    }

    private boolean matchesResult(ExamAttempt attempt, EvaluationResultFilter filter) {
        if (filter == null) {
            return true;
        }
        boolean graded = attempt.getStatus() == ExamAttemptStatus.GRADED
                || attempt.getStatus() == ExamAttemptStatus.SUBMITTED;
        if (!graded) {
            return false;
        }
        return filter == EvaluationResultFilter.PASSED
                ? Boolean.TRUE.equals(attempt.getPassed())
                : !Boolean.TRUE.equals(attempt.getPassed());
    }

    private BigDecimal rate(Double value) {
        return value == null
                ? BigDecimal.ZERO
                : BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }

    private String interpretDiscrimination(double di) {
        if (di >= 0.40) return "Rất tốt";
        if (di >= 0.30) return "Tốt";
        if (di >= 0.20) return "Chấp nhận được";
        if (di >= 0.0) return "Cần xem xét";
        return "Tiêu cực - cần loại bỏ";
    }

    private EvaluationQuestionItemAnalysisResponse toItemAnalysis(QuestionItemAnalysisProjection row) {
        long attemptCount = nullToZero(row.getAttemptCount());
        long correctCount = nullToZero(row.getCorrectCount());
        long wrongCount = Math.max(0, attemptCount - correctCount);
        double correctRate = attemptCount == 0 ? 0 : (double) correctCount / attemptCount;
        return new EvaluationQuestionItemAnalysisResponse(
                row.getQuestionId(),
                row.getStem(),
                row.getTopic(),
                row.getDifficulty(),
                attemptCount,
                correctCount,
                wrongCount,
                correctRate
        );
    }

    private List<EvaluationDistributionItemResponse> toDistribution(List<CountByKeyProjection> rows, int limit) {
        return rows.stream()
                .limit(limit)
                .map(row -> new EvaluationDistributionItemResponse(
                        row.getKey(),
                        label(row.getKey()),
                        row.getCount()
                ))
                .toList();
    }

    private long nullToZero(Long value) {
        return value == null ? 0 : value;
    }

    private String label(String key) {
        if (key == null || key.isBlank()) {
            return "Không xác định";
        }
        return switch (key) {
            case "APPROVED" -> "Đã duyệt";
            case "DRAFT" -> "Bản nháp";
            case "REJECTED" -> "Đã từ chối";
            case "ARCHIVED" -> "Đã lưu trữ";
            case "IN_PROGRESS" -> "Đang làm";
            case "SUBMITTED" -> "Đã nộp";
            case "GRADED" -> "Đã chấm";
            case "EXPIRED" -> "Quá hạn";
            case "CANCELLED" -> "Đã hủy";
            default -> key;
        };
    }
}
