package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptBriefResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.FormSubmissionBriefResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencyKnowledgeResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencySkillResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.MyCompetencySummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MyCompetencyService {

    private final ExamAttemptRepository attemptRepository;
    private final FormSubmissionRepository formSubmissionRepository;
    private final CompetencyClassificationService classificationService;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /**
     * Build knowledge competency report for current user, grouped by category.
     * Category is derived from QuestionSet.category string in the exam chain.
     */
    @Transactional(readOnly = true)
    public MyCompetencyKnowledgeResponse getKnowledgeCompetency(User user, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();

        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime)
                .stream()
                .filter(attempt -> attempt.getScore() != null)
                .toList();

        if (attempts.isEmpty()) {
            return new MyCompetencyKnowledgeResponse(
                    from.format(DATE_FMT), to.format(DATE_FMT),
                    null, 0, List.of()
            );
        }

        // Group by QuestionSet.category string
        Map<String, List<ExamAttempt>> groupedByCategory = new LinkedHashMap<>();
        for (ExamAttempt a : attempts) {
            String category = getCategoryName(a);
            groupedByCategory.computeIfAbsent(category, k -> new ArrayList<>()).add(a);
        }

        List<KnowledgeCompetencyItemResponse> items = new ArrayList<>();
        BigDecimal totalScoreSum = BigDecimal.ZERO;
        int totalAttemptCount = 0;

        for (Map.Entry<String, List<ExamAttempt>> entry : groupedByCategory.entrySet()) {
            String categoryName = entry.getKey();
            List<ExamAttempt> catAttempts = entry.getValue();

            BigDecimal sum = BigDecimal.ZERO;
            int passCount = 0;
            for (ExamAttempt a : catAttempts) {
                sum = sum.add(a.getScore());
                if (Boolean.TRUE.equals(a.getPassed())) {
                    passCount++;
                }
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(catAttempts.size()), 2, RoundingMode.HALF_UP);
            double passRate = catAttempts.size() > 0
                    ? Math.round((passCount * 100.0 / catAttempts.size()) * 10.0) / 10.0
                    : 0.0;

            CompetencyLevel level = classificationService.classifyOverall(avg);
            boolean isPassed = level != CompetencyLevel.NOT_COMPETENT;

            List<ExamAttemptBriefResponse> attemptBriefs = catAttempts.stream()
                    .map(this::toExamAttemptBrief)
                    .toList();

            items.add(new KnowledgeCompetencyItemResponse(
                    null, // categoryId not available from string-based grouping
                    categoryName,
                    catAttempts.size(),
                    avg,
                    passCount,
                    passRate,
                    level.name(),
                    QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    isPassed,
                    attemptBriefs
            ));

            totalScoreSum = totalScoreSum.add(sum);
            totalAttemptCount += catAttempts.size();
        }

        items.sort(Comparator.comparing(KnowledgeCompetencyItemResponse::categoryName));

        BigDecimal overallAvg = totalAttemptCount > 0
                ? totalScoreSum.divide(BigDecimal.valueOf(totalAttemptCount), 2, RoundingMode.HALF_UP)
                : null;

        return new MyCompetencyKnowledgeResponse(
                from.format(DATE_FMT), to.format(DATE_FMT),
                overallAvg, totalAttemptCount, items
        );
    }

    /**
     * Build skill competency report for current user from form submissions
     * linked via employeeCode in FormSubmissionContext.
     */
    @Transactional(readOnly = true)
    public MyCompetencySkillResponse getSkillCompetency(User user, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();

        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        ZoneId zoneId = ZoneId.systemDefault();
        List<FormSubmission> matched = formSubmissionRepository.findScoredEvaluationsForSubject(
                user.getId(),
                user.getEmployeeCode(),
                fromDateTime.atZone(zoneId).toInstant(),
                toDateTime.atZone(zoneId).toInstant()
        );

        if (matched.isEmpty()) {
            return new MyCompetencySkillResponse(
                    from.format(DATE_FMT), to.format(DATE_FMT),
                    null, 0, List.of()
            );
        }

        // Group by form
        Map<Form, List<FormSubmission>> groupedByForm = new LinkedHashMap<>();
        for (FormSubmission s : matched) {
            Form form = s.getFormVersion() != null ? s.getFormVersion().getForm() : null;
            if (form == null) continue;
            groupedByForm.computeIfAbsent(form, k -> new ArrayList<>()).add(s);
        }

        List<SkillCompetencyItemResponse> items = new ArrayList<>();
        BigDecimal totalScoreSum = BigDecimal.ZERO;
        int totalEvalCount = 0;

        for (Map.Entry<Form, List<FormSubmission>> entry : groupedByForm.entrySet()) {
            Form form = entry.getKey();
            List<FormSubmission> formSubs = entry.getValue();

            BigDecimal sum = BigDecimal.ZERO;
            int passCount = 0;
            for (FormSubmission s : formSubs) {
                BigDecimal score = practicalScore(s);
                sum = sum.add(score);
                if (s.getResult() == vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult.PASSED) {
                    passCount++;
                }
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(formSubs.size()), 2, RoundingMode.HALF_UP);
            double passRate = formSubs.size() > 0
                    ? Math.round((passCount * 100.0 / formSubs.size()) * 10.0) / 10.0
                    : 0.0;

            CompetencyLevel level = classificationService.classifyOverall(avg);
            boolean isPassed = level != CompetencyLevel.NOT_COMPETENT;
            BigDecimal departmentTarget = departmentTarget(user);
            boolean belowTarget = departmentTarget != null && avg.compareTo(departmentTarget) <= 0;

            List<FormSubmissionBriefResponse> submissionBriefs = formSubs.stream()
                    .map(this::toFormSubmissionBrief)
                    .toList();

            items.add(new SkillCompetencyItemResponse(
                    form.getId(),
                    form.getTitle(),
                    formSubs.size(),
                    avg,
                    passCount,
                    passRate,
                    level.name(),
                    QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    isPassed,
                    belowTarget,
                    submissionBriefs
            ));

            totalScoreSum = totalScoreSum.add(sum);
            totalEvalCount += formSubs.size();
        }

        items.sort(Comparator.comparing(SkillCompetencyItemResponse::formName));

        BigDecimal overallAvg = totalEvalCount > 0
                ? totalScoreSum.divide(BigDecimal.valueOf(totalEvalCount), 2, RoundingMode.HALF_UP)
                : null;

        return new MyCompetencySkillResponse(
                from.format(DATE_FMT), to.format(DATE_FMT),
                overallAvg, totalEvalCount, items
        );
    }

    /**
     * Build overall competency summary combining knowledge and skills.
     */
    @Transactional(readOnly = true)
    public MyCompetencySummaryResponse getCompetencySummary(User user, LocalDate fromDate, LocalDate toDate) {
        MyCompetencyKnowledgeResponse knowledge = getKnowledgeCompetency(user, fromDate, toDate);
        MyCompetencySkillResponse skills = getSkillCompetency(user, fromDate, toDate);

        BigDecimal knowledgeAvg = knowledge.overallAverage();
        BigDecimal skillAvg = skills.overallAverage();

        BigDecimal overallScore;
        if (knowledgeAvg != null && skillAvg != null) {
            overallScore = knowledgeAvg.add(skillAvg)
                    .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
        } else {
            overallScore = null;
        }

        CompetencyLevel level = overallScore != null
                ? classificationService.classifyOverall(overallScore)
                : null;

        BigDecimal targetScore = departmentTarget(user);
        boolean isPassed = overallScore != null
                && targetScore != null
                && overallScore.compareTo(targetScore) > 0;

        return new MyCompetencySummaryResponse(
                knowledge.fromDate(),
                knowledge.toDate(),
                knowledgeAvg,
                skillAvg,
                overallScore,
                user.getDepartment() == null ? null : user.getDepartment().getId(),
                user.getDepartment() == null ? null : user.getDepartment().getName(),
                targetScore,
                level != null ? level.name() : null,
                level != null ? QuestionGenerationLabels.competencyLevel(level) : null,
                level != null ? QuestionGenerationLabels.competencyLevelColor(level) : null,
                isPassed
        );
    }

    private ExamAttemptBriefResponse toExamAttemptBrief(ExamAttempt attempt) {
        CompetencyLevel level = attempt.getClassification() != null
                ? attempt.getClassification()
                : classificationService.classifyOverall(attempt.getScore());
        return new ExamAttemptBriefResponse(
                attempt.getId(),
                attempt.getExamPaper() == null ? "Bài kiểm tra" : attempt.getExamPaper().getName(),
                attempt.getSubmittedAt() == null ? null : attempt.getSubmittedAt().toLocalDate(),
                attempt.getScore(),
                attempt.getCorrectCount(),
                attempt.getTotalQuestions(),
                attempt.getPassed(),
                level == null ? null : level.name(),
                level == null ? null : QuestionGenerationLabels.competencyLevel(level),
                level == null ? null : QuestionGenerationLabels.competencyLevelColor(level)
        );
    }

    private FormSubmissionBriefResponse toFormSubmissionBrief(FormSubmission submission) {
        BigDecimal score = practicalScore(submission);
        CompetencyLevel level = classificationService.classifyOverall(score);
        return new FormSubmissionBriefResponse(
                submission.getId(),
                submission.getFormVersion().getForm().getTitle(),
                submission.getSubmittedAt() == null
                        ? null
                        : LocalDateTime.ofInstant(submission.getSubmittedAt(), ZoneId.systemDefault()),
                submission.getSubmittedBy() == null ? null : submission.getSubmittedBy().getName(),
                score,
                submission.getResult() == vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult.PASSED,
                level.name(),
                QuestionGenerationLabels.competencyLevel(level),
                QuestionGenerationLabels.competencyLevelColor(level)
        );
    }

    private BigDecimal practicalScore(FormSubmission submission) {
        if (submission.getConvertedScore() != null) {
            return submission.getConvertedScore().multiply(BigDecimal.TEN).setScale(2, RoundingMode.HALF_UP);
        }
        if (submission.getTotalScore() != null
                && submission.getMaxScore() != null
                && submission.getMaxScore().compareTo(BigDecimal.ZERO) > 0) {
            return submission.getTotalScore()
                    .multiply(BigDecimal.valueOf(100))
                    .divide(submission.getMaxScore(), 2, RoundingMode.HALF_UP);
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal departmentTarget(User user) {
        return user.getDepartment() == null ? null : user.getDepartment().getCompetencyTargetScore();
    }

    private String getCategoryName(ExamAttempt attempt) {
        try {
            return attempt.getExamPaper() != null
                    && attempt.getExamPaper().getExamConfig() != null
                    && attempt.getExamPaper().getExamConfig().getQuestionSet() != null
                    && attempt.getExamPaper().getExamConfig().getQuestionSet().getCategory() != null
                    ? attempt.getExamPaper().getExamConfig().getQuestionSet().getCategory()
                    : "Chung";
        } catch (Exception e) {
            return "Chung";
        }
    }
}
