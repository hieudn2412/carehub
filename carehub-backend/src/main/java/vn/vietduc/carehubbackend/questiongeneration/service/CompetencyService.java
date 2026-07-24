package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmission;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByFieldItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByFieldResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByTechniqueItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByFieldResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencySummaryItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencySummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyTechniqueOptionResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.DepartmentCompetencyTargetResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.ExamAttemptBriefResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.FormSubmissionBriefResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.questiongeneration.repository.QuestionCategoryRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

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
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompetencyService {

    private final ExamAttemptRepository attemptRepository;
    private final FormSubmissionRepository formSubmissionRepository;
    private final FormRepository formRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final QuestionCategoryRepository questionCategoryRepository;
    private final CompetencyClassificationService classificationService;

    @Value("${competency.compliance.default-target:80.0}")
    private double defaultComplianceTarget;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final BigDecimal SUMMARY_WEIGHT = new BigDecimal("0.5");

    @Transactional(readOnly = true)
    public CompetencyByFieldResponse getByField(Long departmentId, Long categoryId, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa/phòng"));
        List<User> users = userRepository.findByDepartment_IdInAndIsDeletedFalse(Set.of(departmentId));

        String categoryName = null;
        String categoryFilter = categoryId != null ? String.valueOf(categoryId) : null;
        if (categoryId != null) {
            var cat = questionCategoryRepository.findById(categoryId).orElse(null);
            categoryName = cat != null ? cat.getName() : null;
        }

        List<CompetencyByFieldItemResponse> items = new ArrayList<>();
        for (User user : users) {
            List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime)
                    .stream()
                    .filter(attempt -> attempt.getScore() != null)
                    .toList();
            if (attempts.isEmpty()) continue;

            // Filter by category if specified
            if (categoryFilter != null) {
                attempts = attempts.stream()
                        .filter(a -> categoryFilter.equals(getCategoryName(a)))
                        .collect(Collectors.toList());
                if (attempts.isEmpty()) continue;
            }

            BigDecimal sum = BigDecimal.ZERO;
            int passCount = 0;
            for (ExamAttempt a : attempts) {
                sum = sum.add(a.getScore());
                if (Boolean.TRUE.equals(a.getPassed())) passCount++;
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(attempts.size()), 2, RoundingMode.HALF_UP);
            double passRate = attempts.size() > 0
                    ? Math.round((passCount * 100.0 / attempts.size()) * 10.0) / 10.0 : 0.0;

            CompetencyLevel level = classificationService.classifyOverall(avg);
            boolean isPassed = level != CompetencyLevel.NOT_COMPETENT;

            items.add(new CompetencyByFieldItemResponse(
                    user.getId(), user.getEmployeeCode(), user.getName(),
                    attempts.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level), isPassed
            ));
        }

        items.sort(Comparator.comparing(CompetencyByFieldItemResponse::employeeName));

        return new CompetencyByFieldResponse(
                department.getId(), department.getName(),
                categoryId, categoryName,
                from.format(DATE_FMT), to.format(DATE_FMT), items
        );
    }

    @Transactional(readOnly = true)
    public CompetencyEmployeeByFieldResponse getEmployeeByField(Long employeeId, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên"));
        List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime)
                .stream()
                .filter(attempt -> attempt.getScore() != null)
                .toList();

        Map<String, List<ExamAttempt>> grouped = new LinkedHashMap<>();
        for (ExamAttempt a : attempts) {
            String cat = getCategoryName(a);
            grouped.computeIfAbsent(cat, k -> new ArrayList<>()).add(a);
        }

        List<vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse> items = new ArrayList<>();
        for (var entry : grouped.entrySet()) {
            String catName = entry.getKey();
            List<ExamAttempt> catAttempts = entry.getValue();
            BigDecimal sum = BigDecimal.ZERO;
            int passCount = 0;
            for (ExamAttempt a : catAttempts) {
                sum = sum.add(a.getScore());
                if (Boolean.TRUE.equals(a.getPassed())) passCount++;
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(catAttempts.size()), 2, RoundingMode.HALF_UP);
            double passRate = catAttempts.size() > 0
                    ? Math.round((passCount * 100.0 / catAttempts.size()) * 10.0) / 10.0 : 0.0;
            CompetencyLevel level = classificationService.classifyOverall(avg);

            List<ExamAttemptBriefResponse> attemptBriefs = catAttempts.stream()
                    .sorted(Comparator.comparing(ExamAttempt::getSubmittedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                    .map(a -> {
                        CompetencyLevel aLevel = a.getClassification();
                        return new ExamAttemptBriefResponse(
                                a.getId(),
                                a.getExamPaper() != null ? a.getExamPaper().getName() : "—",
                                a.getSubmittedAt() != null ? a.getSubmittedAt().toLocalDate() : null,
                                a.getScore(),
                                a.getCorrectCount(),
                                a.getTotalQuestions(),
                                a.getPassed(),
                                aLevel != null ? aLevel.name() : null,
                                aLevel != null ? QuestionGenerationLabels.competencyLevel(aLevel) : null,
                                aLevel != null ? QuestionGenerationLabels.competencyLevelColor(aLevel) : null
                        );
                    })
                    .collect(Collectors.toList());

            items.add(new vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse(
                    null, catName, catAttempts.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    level != CompetencyLevel.NOT_COMPETENT,
                    attemptBriefs
            ));
        }
        items.sort(Comparator.comparing(vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse::categoryName));

        return new CompetencyEmployeeByFieldResponse(
                user.getId(), user.getName(), user.getEmployeeCode(),
                from.format(DATE_FMT), to.format(DATE_FMT), items
        );
    }

    @Transactional(readOnly = true)
    public CompetencyByTechniqueResponse getByTechnique(Long departmentId, Long formId, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        ZoneId zoneId = ZoneId.systemDefault();

        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa/phòng"));
        List<FormSubmission> departmentSubmissions =
                formSubmissionRepository.findScoredEvaluationsForDepartment(
                        departmentId,
                        from.atStartOfDay(zoneId).toInstant(),
                        to.plusDays(1).atStartOfDay(zoneId).toInstant().minusNanos(1)
                );

        List<CompetencyTechniqueOptionResponse> forms = departmentSubmissions.stream()
                .map(FormSubmission::getFormVersion)
                .filter(java.util.Objects::nonNull)
                .map(version -> version.getForm())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toMap(
                        Form::getId,
                        form -> new CompetencyTechniqueOptionResponse(form.getId(), form.getTitle()),
                        (left, right) -> left,
                        LinkedHashMap::new
                ))
                .values().stream()
                .sorted(Comparator.comparing(CompetencyTechniqueOptionResponse::title))
                .toList();

        List<FormSubmission> matched = departmentSubmissions.stream()
                .filter(submission -> formId == null
                        || (submission.getFormVersion() != null
                        && submission.getFormVersion().getForm() != null
                        && formId.equals(submission.getFormVersion().getForm().getId())))
                .toList();

        Map<Long, List<FormSubmission>> grouped = matched.stream()
                .filter(submission -> submission.getSubjectContext() != null)
                .filter(submission -> submission.getSubjectContext().getSubjectUser() != null)
                .collect(Collectors.groupingBy(
                        submission -> submission.getSubjectContext().getSubjectUser().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<CompetencyByTechniqueItemResponse> items = new ArrayList<>();
        for (var entry : grouped.entrySet()) {
            List<FormSubmission> subs = entry.getValue();
            User subject = subs.get(0).getSubjectContext().getSubjectUser();

            BigDecimal sum = BigDecimal.ZERO;
            int passCount = 0;
            for (FormSubmission s : subs) {
                BigDecimal score = s.getTotalScore() != null ? s.getTotalScore() : BigDecimal.ZERO;
                sum = sum.add(score);
                if (s.getResult() == vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult.PASSED) {
                    passCount++;
                }
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(subs.size()), 2, RoundingMode.HALF_UP);
            double passRate = subs.size() > 0
                    ? Math.round((passCount * 100.0 / subs.size()) * 10.0) / 10.0 : 0.0;
            boolean belowTarget = passRate < defaultComplianceTarget;

            CompetencyLevel level = classificationService.classifyOverall(avg);

            items.add(new CompetencyByTechniqueItemResponse(
                    subject.getId(), subject.getEmployeeCode(), subject.getName(),
                    department.getName(),
                    subs.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    level != CompetencyLevel.NOT_COMPETENT, belowTarget
            ));
        }

        items.sort(Comparator.comparing(CompetencyByTechniqueItemResponse::employeeName));

        String formName = null;
        if (formId != null) {
            var form = foundById(formId);
            formName = form != null ? form.getTitle() : null;
        }

        return new CompetencyByTechniqueResponse(
                department.getId(), department.getName(),
                formId, formName, defaultComplianceTarget,
                from.format(DATE_FMT), to.format(DATE_FMT), forms, items
        );
    }

    @Transactional(readOnly = true)
    public CompetencyEmployeeByTechniqueResponse getEmployeeByTechnique(Long employeeId, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên"));
        ZoneId zoneId = ZoneId.systemDefault();
        List<FormSubmission> matched = formSubmissionRepository.findScoredEvaluationsForSubject(
                user.getId(),
                user.getEmployeeCode(),
                from.atStartOfDay(zoneId).toInstant(),
                to.plusDays(1).atStartOfDay(zoneId).toInstant().minusNanos(1)
        );

        Map<Form, List<FormSubmission>> grouped = new LinkedHashMap<>();
        for (FormSubmission s : matched) {
            Form form = s.getFormVersion() != null ? s.getFormVersion().getForm() : null;
            if (form == null) continue;
            grouped.computeIfAbsent(form, k -> new ArrayList<>()).add(s);
        }

        List<vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse> items = new ArrayList<>();
        for (var entry : grouped.entrySet()) {
            Form form = entry.getKey();
            List<FormSubmission> subs = entry.getValue();

            BigDecimal sum = BigDecimal.ZERO;
            int passCount = 0;
            for (FormSubmission s : subs) {
                sum = sum.add(s.getTotalScore() != null ? s.getTotalScore() : BigDecimal.ZERO);
                if (s.getResult() == vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult.PASSED) {
                    passCount++;
                }
            }
            BigDecimal avg = sum.divide(BigDecimal.valueOf(subs.size()), 2, RoundingMode.HALF_UP);
            double passRate = subs.size() > 0
                    ? Math.round((passCount * 100.0 / subs.size()) * 10.0) / 10.0 : 0.0;
            boolean belowTarget = passRate < defaultComplianceTarget;
            CompetencyLevel level = classificationService.classifyOverall(avg);

            List<FormSubmissionBriefResponse> submissionBriefs = subs.stream()
                    .sorted(Comparator.comparing(s -> {
                        java.time.Instant i = s.getSubmittedAt();
                        return i != null ? i : java.time.Instant.EPOCH;
                    }, Comparator.reverseOrder()))
                    .map(s -> {
                        CompetencyLevel sLevel = classificationService.classifyOverall(
                                s.getTotalScore() != null ? s.getTotalScore() : BigDecimal.ZERO);
                        return new FormSubmissionBriefResponse(
                                s.getId(),
                                form.getTitle(),
                                s.getSubmittedAt() != null
                                        ? LocalDateTime.ofInstant(s.getSubmittedAt(), java.time.ZoneId.systemDefault())
                                        : null,
                                s.getSubmittedBy().getName(),
                                s.getTotalScore(),
                                s.getResult() == vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionResult.PASSED,
                                sLevel.name(),
                                QuestionGenerationLabels.competencyLevel(sLevel),
                                QuestionGenerationLabels.competencyLevelColor(sLevel)
                        );
                    })
                    .collect(Collectors.toList());

            items.add(new vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse(
                    form.getId(), form.getTitle(), subs.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    level != CompetencyLevel.NOT_COMPETENT, belowTarget,
                    submissionBriefs
            ));
        }
        items.sort(Comparator.comparing(vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse::formName));

        BigDecimal overallAvg = items.isEmpty() ? null
                : items.stream()
                .map(SkillCompetencyItemResponse::averageScore)
                .filter(s -> s != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(items.size()), 2, RoundingMode.HALF_UP);

        String departmentName = user.getDepartment() != null ? user.getDepartment().getName() : null;
        Long departmentId = user.getDepartment() != null ? user.getDepartment().getId() : null;

        return new CompetencyEmployeeByTechniqueResponse(
                user.getId(), user.getName(), user.getEmployeeCode(),
                departmentId, departmentName,
                from.format(DATE_FMT), to.format(DATE_FMT), defaultComplianceTarget, overallAvg, items
        );
    }

    @Transactional(readOnly = true)
    public CompetencySummaryResponse getSummary(Long departmentId, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa/phòng"));
        BigDecimal targetScore = department.getCompetencyTargetScore();
        List<User> users = userRepository.findByDepartment_IdInAndIsDeletedFalse(Set.of(departmentId));

        List<CompetencySummaryItemResponse> items = new ArrayList<>();
        for (User user : users) {
            // Knowledge
            List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime)
                    .stream()
                    .filter(attempt -> attempt.getScore() != null)
                    .toList();
            BigDecimal knowledgeAvg = null;
            if (!attempts.isEmpty()) {
                BigDecimal kSum = BigDecimal.ZERO;
                for (ExamAttempt a : attempts) kSum = kSum.add(a.getScore());
                knowledgeAvg = kSum.divide(BigDecimal.valueOf(attempts.size()), 2, RoundingMode.HALF_UP);
            }

            // Skills
            ZoneId zoneId = ZoneId.systemDefault();
            List<FormSubmission> userSubs = formSubmissionRepository.findScoredEvaluationsForSubject(
                    user.getId(),
                    user.getEmployeeCode(),
                    fromDateTime.atZone(zoneId).toInstant(),
                    toDateTime.atZone(zoneId).toInstant()
            );

            BigDecimal skillAvg = null;
            if (!userSubs.isEmpty()) {
                BigDecimal sSum = BigDecimal.ZERO;
                for (FormSubmission s : userSubs) {
                    sSum = sSum.add(practicalScore(s));
                }
                skillAvg = sSum.divide(BigDecimal.valueOf(userSubs.size()), 2, RoundingMode.HALF_UP);
            }

            // Calculate overall
            BigDecimal overallScore = null;
            if (knowledgeAvg != null && skillAvg != null) {
                overallScore = knowledgeAvg.add(skillAvg)
                        .divide(BigDecimal.valueOf(2), 2, RoundingMode.HALF_UP);
            }

            CompetencyLevel level = overallScore != null
                    ? classificationService.classifyOverall(overallScore) : null;

            items.add(new CompetencySummaryItemResponse(
                    user.getId(), user.getEmployeeCode(), user.getName(),
                    knowledgeAvg, skillAvg, overallScore,
                    level != null ? level.name() : null,
                    level != null ? QuestionGenerationLabels.competencyLevel(level) : null,
                    level != null ? QuestionGenerationLabels.competencyLevelColor(level) : null,
                    overallScore != null && targetScore != null && overallScore.compareTo(targetScore) > 0
            ));
        }

        items.sort(Comparator.comparing(CompetencySummaryItemResponse::employeeName));

        return new CompetencySummaryResponse(
                department.getId(), department.getName(),
                from.format(DATE_FMT), to.format(DATE_FMT),
                SUMMARY_WEIGHT, SUMMARY_WEIGHT,
                targetScore,
                items
        );
    }

    @Transactional
    public DepartmentCompetencyTargetResponse updateDepartmentTarget(
            Long departmentId,
            BigDecimal targetScore,
            User actor,
            boolean admin
    ) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new vn.vietduc.carehubbackend.exception.ResourceNotFoundException(
                        "Không tìm thấy khoa/phòng"
                ));
        if (!admin && (actor.getDepartment() == null
                || !departmentId.equals(actor.getDepartment().getId()))) {
            throw new vn.vietduc.carehubbackend.exception.ForbiddenException(
                    "Manager chỉ được cập nhật mục tiêu của khoa mình"
            );
        }
        department.setCompetencyTargetScore(targetScore.setScale(2, RoundingMode.HALF_UP));
        Department saved = departmentRepository.save(department);
        return new DepartmentCompetencyTargetResponse(
                saved.getId(),
                saved.getName(),
                saved.getCompetencyTargetScore()
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

    private Form foundById(Long formId) {
        return formRepository.findByIdAndDeletedFalse(formId).orElse(null);
    }
}
