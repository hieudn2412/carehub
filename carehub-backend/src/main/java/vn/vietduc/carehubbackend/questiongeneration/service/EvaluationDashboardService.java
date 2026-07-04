package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDashboardResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationDistributionItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationExamResultsSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionBankSummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationQuestionItemAnalysisResponse;
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
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EvaluationDashboardService {
    private static final int TOP_DISTRIBUTION_LIMIT = 12;
    private static final int TOP_ITEM_ANALYSIS_LIMIT = 50;

    private final QuestionBankQuestionRepository questionRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamAttemptAnswerRepository answerRepository;

    @Transactional(readOnly = true)
    public EvaluationDashboardResponse dashboard() {
        return new EvaluationDashboardResponse(
                questionBankSummary(),
                examResultsSummary(),
                itemAnalysis()
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
        List<ExamAttempt> attempts = attemptRepository.findAllByOrderByStartedAtDesc();
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
        return answerRepository.analyzeQuestionItems(List.of(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.GRADED)).stream()
                .limit(TOP_ITEM_ANALYSIS_LIMIT)
                .map(this::toItemAnalysis)
                .toList();
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
