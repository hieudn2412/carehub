package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCellResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCognitiveResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamBlueprintField;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CognitiveLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCellResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCognitiveResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamBlueprintFieldRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builds the Phase 7 reporting aggregates from paper-question snapshots only.
 * The bulk-delete followed by inserts is deliberately idempotent for a grading retry;
 * regrading must enter through an audited policy endpoint, not by changing this aggregate.
 */
@Service
@RequiredArgsConstructor
public class ExamAttemptResultAggregationService {
    private final ExamAttemptFieldResultRepository fieldResultRepository;
    private final ExamAttemptCognitiveResultRepository cognitiveResultRepository;
    private final ExamAttemptCellResultRepository cellResultRepository;
    private final ExamBlueprintFieldRepository blueprintFieldRepository;

    @Transactional
    public void rebuildFromGrade(
            ExamAttempt attempt,
            List<ExamPaperQuestion> questions,
            Map<Long, ExamPaperQuestionSnapshot> snapshots,
            Map<Long, ExamAttemptAnswer> answers
    ) {
        fieldResultRepository.deleteByAttempt(attempt);
        cognitiveResultRepository.deleteByAttempt(attempt);
        cellResultRepository.deleteByAttempt(attempt);

        Map<Long, FieldTally> byField = new LinkedHashMap<>();
        Map<CognitiveLevel, CognitiveTally> byCognitive = new LinkedHashMap<>();
        Map<CellKey, CellTally> byCell = new LinkedHashMap<>();
        for (ExamPaperQuestion question : questions) {
            ExamPaperQuestionSnapshot snapshot = snapshots.get(question.getId());
            if (snapshot == null || snapshot.getProfessionalFieldId() == null) {
                continue;
            }
            boolean correct = Boolean.TRUE.equals(answer(answers, question).getCorrect());
            Long fieldId = snapshot.getProfessionalFieldId();
            FieldTally field = byField.computeIfAbsent(fieldId, ignored -> new FieldTally(
                    fieldId,
                    textOrFallback(snapshot.getProfessionalFieldCode()),
                    textOrFallback(snapshot.getProfessionalFieldName(), "Lĩnh vực #" + fieldId)
            ));
            field.add(correct);

            CognitiveLevel cognitive = parseCognitive(snapshot.getCognitiveLevel());
            if (cognitive == null) {
                continue;
            }
            String cognitiveLabel = textOrFallback(snapshot.getCognitiveLabel(), QuestionGenerationLabels.cognitiveLevel(cognitive));
            byCognitive.computeIfAbsent(cognitive, ignored -> new CognitiveTally(cognitive, cognitiveLabel)).add(correct);
            byCell.computeIfAbsent(new CellKey(fieldId, cognitive), ignored -> new CellTally(
                    fieldId, field.code, field.name, cognitive, cognitiveLabel
            )).add(correct);
        }

        Map<Long, BigDecimal> fieldThresholds = thresholds(attempt);
        BigDecimal defaultThreshold = normalizedPaperThreshold(attempt);
        byField.values().forEach(tally -> {
            BigDecimal score = score(tally.correct, tally.total);
            BigDecimal threshold = fieldThresholds.getOrDefault(tally.fieldId, defaultThreshold);
            fieldResultRepository.save(ExamAttemptFieldResult.builder()
                    .attempt(attempt)
                    .professionalFieldId(tally.fieldId)
                    .professionalFieldCode(tally.code)
                    .professionalFieldName(tally.name)
                    .correctCount(tally.correct)
                    .totalQuestions(tally.total)
                    .score(score)
                    .passingThreshold(threshold)
                    .passed(score.compareTo(threshold) >= 0)
                    .build());
        });
        byCognitive.values().forEach(tally -> cognitiveResultRepository.save(ExamAttemptCognitiveResult.builder()
                .attempt(attempt)
                .cognitiveLevel(tally.level)
                .cognitiveLabel(tally.label)
                .correctCount(tally.correct)
                .totalQuestions(tally.total)
                .score(score(tally.correct, tally.total))
                .build()));
        byCell.values().forEach(tally -> cellResultRepository.save(ExamAttemptCellResult.builder()
                .attempt(attempt)
                .professionalFieldId(tally.fieldId)
                .professionalFieldCode(tally.fieldCode)
                .professionalFieldName(tally.fieldName)
                .cognitiveLevel(tally.cognitiveLevel)
                .cognitiveLabel(tally.cognitiveLabel)
                .correctCount(tally.correct)
                .totalQuestions(tally.total)
                .smallSample(tally.total <= 1)
                .build()));
    }

    private Map<Long, BigDecimal> thresholds(ExamAttempt attempt) {
        if (attempt.getExamPaper() == null || attempt.getExamPaper().getExamConfig() == null) {
            return Map.of();
        }
        return blueprintFieldRepository.findByExamConfigIdOrderByDisplayOrderAsc(attempt.getExamPaper().getExamConfig().getId())
                .stream()
                .filter(field -> field.getPassingThreshold() != null)
                .collect(java.util.stream.Collectors.toMap(
                        field -> field.getProfessionalField().getId(),
                        ExamBlueprintField::getPassingThreshold,
                        (left, right) -> left,
                        LinkedHashMap::new));
    }

    private BigDecimal normalizedPaperThreshold(ExamAttempt attempt) {
        BigDecimal value = BigDecimal.valueOf(attempt.getExamPaper().getPassingScore());
        return value.compareTo(BigDecimal.TEN) > 0
                ? value.divide(BigDecimal.TEN, 2, RoundingMode.HALF_UP)
                : value;
    }

    private ExamAttemptAnswer answer(Map<Long, ExamAttemptAnswer> answers, ExamPaperQuestion question) {
        return answers.getOrDefault(question.getId(), ExamAttemptAnswer.builder().build());
    }

    private CognitiveLevel parseCognitive(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return CognitiveLevel.valueOf(value.trim());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private BigDecimal score(int correct, int total) {
        return total == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(correct).multiply(BigDecimal.TEN)
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }

    private String textOrFallback(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String textOrFallback(String value, String fallback) {
        String normalized = textOrFallback(value);
        return normalized == null ? fallback : normalized;
    }

    private static final class FieldTally {
        private final Long fieldId;
        private final String code;
        private final String name;
        private int correct;
        private int total;

        private FieldTally(Long fieldId, String code, String name) {
            this.fieldId = fieldId;
            this.code = code;
            this.name = name;
        }

        private void add(boolean isCorrect) { total++; if (isCorrect) correct++; }
    }

    private static final class CognitiveTally {
        private final CognitiveLevel level;
        private final String label;
        private int correct;
        private int total;

        private CognitiveTally(CognitiveLevel level, String label) { this.level = level; this.label = label; }
        private void add(boolean isCorrect) { total++; if (isCorrect) correct++; }
    }

    private record CellKey(Long fieldId, CognitiveLevel cognitiveLevel) { }

    private static final class CellTally {
        private final Long fieldId;
        private final String fieldCode;
        private final String fieldName;
        private final CognitiveLevel cognitiveLevel;
        private final String cognitiveLabel;
        private int correct;
        private int total;

        private CellTally(Long fieldId, String fieldCode, String fieldName, CognitiveLevel cognitiveLevel, String cognitiveLabel) {
            this.fieldId = fieldId;
            this.fieldCode = fieldCode;
            this.fieldName = fieldName;
            this.cognitiveLevel = cognitiveLevel;
            this.cognitiveLabel = cognitiveLabel;
        }

        private void add(boolean isCorrect) { total++; if (isCorrect) correct++; }
    }
}
