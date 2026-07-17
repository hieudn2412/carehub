package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionContext;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse;
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
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MyCompetencyService {

    private final ExamAttemptRepository attemptRepository;
    private final FormSubmissionRepository formSubmissionRepository;
    private final CompetencyClassificationService classificationService;

    @Value("${competency.compliance.default-target:80.0}")
    private double defaultComplianceTarget;

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

        List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime);

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
                    List.of()
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

        // Query all form submissions for current user
        List<FormSubmission> allSubmissions = formSubmissionRepository.findAll();

        // Filter: submittedBy = current user, status = SUBMITTED, within date range
        // and where subjectContext.employeeCode matches user.employeeCode
        List<FormSubmission> matched = allSubmissions.stream()
                .filter(s -> s.getSubmittedBy().getId().equals(user.getId()))
                .filter(s -> s.getStatus() == FormSubmissionStatus.SUBMITTED)
                .filter(s -> s.getSubmittedAt() != null)
                .filter(s -> {
                    java.time.Instant instant = s.getSubmittedAt();
                    LocalDateTime dt = LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault());
                    return !dt.isBefore(fromDateTime) && !dt.isAfter(toDateTime);
                })
                .filter(s -> {
                    FormSubmissionContext ctx = s.getSubjectContext();
                    if (ctx == null) return true;
                    String ec = ctx.getEmployeeCode();
                    return ec == null || ec.isBlank() || ec.equals(user.getEmployeeCode());
                })
                .collect(Collectors.toList());

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
                BigDecimal score = s.getTotalScore() != null ? s.getTotalScore() : BigDecimal.ZERO;
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
            boolean belowTarget = passRate < defaultComplianceTarget;

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
                    List.of()
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
        } else if (knowledgeAvg != null) {
            overallScore = knowledgeAvg;
        } else if (skillAvg != null) {
            overallScore = skillAvg;
        } else {
            overallScore = null;
        }

        CompetencyLevel level = overallScore != null
                ? classificationService.classifyOverall(overallScore)
                : null;

        boolean isPassed = level != null && level != CompetencyLevel.NOT_COMPETENT;

        return new MyCompetencySummaryResponse(
                knowledge.fromDate(),
                knowledge.toDate(),
                knowledgeAvg,
                skillAvg,
                overallScore,
                level != null ? level.name() : null,
                level != null ? QuestionGenerationLabels.competencyLevel(level) : null,
                level != null ? QuestionGenerationLabels.competencyLevelColor(level) : null,
                isPassed
        );
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
