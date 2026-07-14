package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DiscriminationIndexResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDistributionItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionBankSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionItemAnalysisResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.WrongAnswerDistributionResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.ExamAttemptStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionBankStatus;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.QuestionType;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionBankQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.CountByKeyProjection;
import vn.vietduc.carehubbackend.questiongeneration.repository.projection.QuestionItemAnalysisProjection;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
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

    @Transactional(readOnly = true)
    public EvaluationDashboardResponse dashboard() {
        return dashboard(null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public EvaluationDashboardResponse dashboard(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId) {
        return new EvaluationDashboardResponse(
                questionBankSummary(),
                examResultsSummary(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId),
                itemAnalysis(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId)
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
        return examResultsSummary(null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public EvaluationExamResultsSummaryResponse examResultsSummary(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId) {
        List<ExamAttempt> attempts = filterAttempts(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId);
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

        return new EvaluationExamResultsSummaryResponse(
                total,
                attemptRepository.countByStatus(ExamAttemptStatus.IN_PROGRESS),
                graded,
                attemptRepository.countByStatus(ExamAttemptStatus.EXPIRED),
                passed,
                failed,
                averageScore,
                passRate,
                averageTimeSpent,
                toDistribution(attemptRepository.countGroupByStatus(), TOP_DISTRIBUTION_LIMIT)
        );
    }

    @Transactional(readOnly = true)
    public List<EvaluationQuestionItemAnalysisResponse> itemAnalysis() {
        return itemAnalysis(null, null, null, null, null, null);
    }

    @Transactional(readOnly = true)
    public List<EvaluationQuestionItemAnalysisResponse> itemAnalysis(
            LocalDateTime fromDate, LocalDateTime toDate,
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId) {
        List<ExamAttempt> filteredAttempts = filterAttempts(fromDate, toDate, examConfigId, paperId, assignmentId, departmentId);
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
        List<ExamAttempt> attempts = filterAttempts(null, null, null, paperId, assignmentId, null);
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
        List<ExamAttempt> attempts = filterAttempts(null, null, null, paperId, null, null);
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
            Long examConfigId, Long paperId, Long assignmentId, Long departmentId) {
        List<ExamAttempt> attempts = attemptRepository.findAllByOrderByStartedAtDesc();
        return attempts.stream()
                .filter(a -> fromDate == null || (a.getStartedAt() != null && !a.getStartedAt().isBefore(fromDate)))
                .filter(a -> toDate == null || (a.getStartedAt() != null && !a.getStartedAt().isAfter(toDate)))
                .filter(a -> examConfigId == null || (a.getExamPaper() != null && a.getExamPaper().getExamConfig() != null
                        && a.getExamPaper().getExamConfig().getId().equals(examConfigId)))
                .filter(a -> paperId == null || (a.getExamPaper() != null && a.getExamPaper().getId().equals(paperId)))
                .filter(a -> assignmentId == null || (a.getAssignment() != null && a.getAssignment().getId().equals(assignmentId)))
                .filter(a -> departmentId == null || (a.getUser() != null && a.getUser().getDepartment() != null
                        && a.getUser().getDepartment().getId().equals(departmentId)))
                .toList();
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
