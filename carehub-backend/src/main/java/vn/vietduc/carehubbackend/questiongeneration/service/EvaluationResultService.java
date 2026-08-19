package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.BadRequestException;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.EvaluationResultReportResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptResultBreakdownResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCellResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptCognitiveResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptFieldResult;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttemptAnswer;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestion;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamPaperQuestionSnapshot;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptAnswerRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCellResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptCognitiveResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptFieldResultRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamPaperQuestionSnapshotRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Read-model for Phase 7 results. All labels come from grading snapshots, never live taxonomy. */
@Service
@RequiredArgsConstructor
public class EvaluationResultService {
    private final ExamAttemptRepository attemptRepository;
    private final ExamAttemptFieldResultRepository fieldResultRepository;
    private final ExamAttemptCognitiveResultRepository cognitiveResultRepository;
    private final ExamAttemptCellResultRepository cellResultRepository;
    private final ExamAttemptAnswerRepository answerRepository;
    private final ExamPaperQuestionRepository paperQuestionRepository;
    private final ExamPaperQuestionSnapshotRepository snapshotRepository;

    @Transactional(readOnly = true)
    public ExamAttemptResultBreakdownResponse attemptBreakdown(Long attemptId) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lượt làm bài"));
        return new ExamAttemptResultBreakdownResponse(
                attempt.getId(), attempt.getAssignment().getId(), attempt.getUser().getId(), attempt.getScore(), attempt.getPassed(),
                fieldResultRepository.findByAttemptOrderByProfessionalFieldIdAsc(attempt).stream()
                        .map(result -> new ExamAttemptResultBreakdownResponse.FieldResult(result.getProfessionalFieldId(), result.getProfessionalFieldCode(),
                                result.getProfessionalFieldName(), result.getCorrectCount(), result.getTotalQuestions(), result.getScore(),
                                result.getPassingThreshold(), Boolean.TRUE.equals(result.getPassed())))
                        .toList(),
                cognitiveResultRepository.findByAttemptOrderByCognitiveLevelAsc(attempt).stream()
                        .map(result -> new ExamAttemptResultBreakdownResponse.CognitiveResult(result.getCognitiveLevel().name(), result.getCognitiveLabel(),
                                result.getCorrectCount(), result.getTotalQuestions(), result.getScore()))
                        .toList(),
                cellResultRepository.findByAttemptOrderByProfessionalFieldIdAscCognitiveLevelAsc(attempt).stream()
                        .map(result -> new ExamAttemptResultBreakdownResponse.CellResult(result.getProfessionalFieldId(), result.getProfessionalFieldCode(),
                                result.getProfessionalFieldName(), result.getCognitiveLevel().name(), result.getCognitiveLabel(), result.getCorrectCount(),
                                result.getTotalQuestions(), Boolean.TRUE.equals(result.getSmallSample())))
                        .toList(),
                questionResults(attempt)
        );
    }

    private List<ExamAttemptResultBreakdownResponse.QuestionResult> questionResults(ExamAttempt attempt) {
        Map<Long, ExamAttemptAnswer> answers = answerRepository.findByAttemptOrderByPaperQuestionPositionAsc(attempt).stream()
                .collect(java.util.stream.Collectors.toMap(answer -> answer.getPaperQuestion().getId(), answer -> answer));
        List<ExamPaperQuestion> questions = paperQuestionRepository.findByExamPaperOrderByPositionAsc(attempt.getExamPaper());
        return questions.stream().map(question -> {
            ExamPaperQuestionSnapshot snapshot = snapshotRepository.findByExamPaperQuestion(question).orElse(null);
            ExamAttemptAnswer answer = answers.get(question.getId());
            return new ExamAttemptResultBreakdownResponse.QuestionResult(question.getId(), question.getPosition(),
                    snapshot == null ? null : snapshot.getProfessionalFieldId(), snapshot == null ? null : snapshot.getProfessionalFieldCode(),
                    snapshot == null ? null : snapshot.getProfessionalFieldName(), snapshot == null ? null : snapshot.getCognitiveLevel(),
                    snapshot == null ? null : snapshot.getCognitiveLabel(), snapshot == null ? null : snapshot.getStem(),
                    answer == null ? null : answer.getCorrect());
        }).toList();
    }

    @Transactional(readOnly = true)
    public EvaluationResultReportResponse report(Long assignmentId) {
        return report(assignmentId, null, null, null, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public EvaluationResultReportResponse report(
            Long assignmentId, Long departmentId, Integer seniorityMonthsLt, Integer seniorityMonthsGte, LocalDate asOfDate
    ) {
        if ((seniorityMonthsLt != null && seniorityMonthsLt < 0) || (seniorityMonthsGte != null && seniorityMonthsGte < 0)) {
            throw new BadRequestException("Ngưỡng thâm niên không được âm");
        }
        List<ExamAttemptFieldResult> fieldResults = fieldResultRepository.findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(assignmentId).stream()
                .filter(result -> matchesScope(result.getAttempt(), departmentId, seniorityMonthsLt, seniorityMonthsGte, asOfDate))
                .toList();
        java.util.Set<Long> scopedAttemptIds = fieldResults.stream().map(result -> result.getAttempt().getId())
                .collect(java.util.stream.Collectors.toSet());
        List<ExamAttemptCognitiveResult> cognitiveResults = cognitiveResultRepository.findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(assignmentId).stream()
                .filter(result -> scopedAttemptIds.contains(result.getAttempt().getId())).toList();
        List<ExamAttemptCellResult> cellResults = cellResultRepository.findByAttemptAssignmentIdOrderByAttemptSubmittedAtDesc(assignmentId).stream()
                .filter(result -> scopedAttemptIds.contains(result.getAttempt().getId())).toList();
        long gradedAttempts = fieldResults.stream().map(result -> result.getAttempt().getId()).distinct().count();

        Map<Long, FieldTally> fields = new LinkedHashMap<>();
        fieldResults.forEach(result -> fields.computeIfAbsent(result.getProfessionalFieldId(), ignored -> new FieldTally(result)).add(result));
        Map<String, CognitiveTally> cognitive = new LinkedHashMap<>();
        cognitiveResults.forEach(result -> cognitive.computeIfAbsent(result.getCognitiveLevel().name(), ignored -> new CognitiveTally(result)).add(result));
        Map<String, CellTally> cells = new LinkedHashMap<>();
        cellResults.forEach(result -> cells.computeIfAbsent(result.getProfessionalFieldId() + ":" + result.getCognitiveLevel(), ignored -> new CellTally(result)).add(result));

        return new EvaluationResultReportResponse(
                assignmentId,
                gradedAttempts,
                fields.values().stream().map(FieldTally::toResponse).sorted(Comparator.comparing(EvaluationResultReportResponse.FieldCoverage::professionalFieldName)).toList(),
                cognitive.values().stream().map(CognitiveTally::toResponse).sorted(Comparator.comparing(EvaluationResultReportResponse.CognitiveCoverage::cognitiveLevel)).toList(),
                cells.values().stream().map(CellTally::toResponse).sorted(Comparator.comparing(EvaluationResultReportResponse.CellCoverage::professionalFieldName)
                        .thenComparing(EvaluationResultReportResponse.CellCoverage::cognitiveLevel)).toList()
        );
    }

    private boolean matchesScope(ExamAttempt attempt, Long departmentId, Integer seniorityMonthsLt, Integer seniorityMonthsGte, LocalDate asOfDate) {
        if (departmentId != null && (attempt.getUser().getDepartment() == null || !departmentId.equals(attempt.getUser().getDepartment().getId()))) return false;
        if (seniorityMonthsLt == null && seniorityMonthsGte == null) return true;
        if (attempt.getUser().getEmploymentStartDate() == null) return false;
        LocalDate asOf = asOfDate == null ? LocalDate.now() : asOfDate;
        java.time.Period period = java.time.Period.between(attempt.getUser().getEmploymentStartDate(), asOf);
        int months = period.getYears() * 12 + period.getMonths();
        return (seniorityMonthsLt == null || months < seniorityMonthsLt)
                && (seniorityMonthsGte == null || months >= seniorityMonthsGte);
    }

    private static BigDecimal score(int correct, int total) {
        return total == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(correct).multiply(BigDecimal.TEN)
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }

    private static final class FieldTally {
        private final Long id; private final String code; private final String name;
        private int correct; private int total; private int passed; private int attempts;
        private FieldTally(ExamAttemptFieldResult result) { id = result.getProfessionalFieldId(); code = result.getProfessionalFieldCode(); name = result.getProfessionalFieldName(); }
        private void add(ExamAttemptFieldResult result) { correct += result.getCorrectCount(); total += result.getTotalQuestions(); attempts++; if (Boolean.TRUE.equals(result.getPassed())) passed++; }
        private EvaluationResultReportResponse.FieldCoverage toResponse() { return new EvaluationResultReportResponse.FieldCoverage(id, code, name, correct, total, score(correct, total), passed, attempts); }
    }

    private static final class CognitiveTally {
        private final String level; private final String label; private int correct; private int total; private int attempts;
        private CognitiveTally(ExamAttemptCognitiveResult result) { level = result.getCognitiveLevel().name(); label = result.getCognitiveLabel(); }
        private void add(ExamAttemptCognitiveResult result) { correct += result.getCorrectCount(); total += result.getTotalQuestions(); attempts++; }
        private EvaluationResultReportResponse.CognitiveCoverage toResponse() { return new EvaluationResultReportResponse.CognitiveCoverage(level, label, correct, total, score(correct, total), attempts); }
    }

    private static final class CellTally {
        private final Long fieldId; private final String fieldCode; private final String fieldName; private final String cognitive; private final String cognitiveLabel;
        private int correct; private int total; private int attempts;
        private CellTally(ExamAttemptCellResult result) { fieldId = result.getProfessionalFieldId(); fieldCode = result.getProfessionalFieldCode(); fieldName = result.getProfessionalFieldName(); cognitive = result.getCognitiveLevel().name(); cognitiveLabel = result.getCognitiveLabel(); }
        private void add(ExamAttemptCellResult result) { correct += result.getCorrectCount(); total += result.getTotalQuestions(); attempts++; }
        private EvaluationResultReportResponse.CellCoverage toResponse() { return new EvaluationResultReportResponse.CellCoverage(fieldId, fieldCode, fieldName, cognitive, cognitiveLabel, correct, total, attempts, total <= attempts); }
    }
}
