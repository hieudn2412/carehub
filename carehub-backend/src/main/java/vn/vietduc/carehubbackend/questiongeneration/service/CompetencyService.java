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
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByFieldItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByFieldResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByTechniqueItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByFieldResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencyEmployeeByTechniqueResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencySummaryItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.CompetencySummaryResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse;
import vn.vietduc.carehubbackend.questiongeneration.entity.ExamAttempt;
import vn.vietduc.carehubbackend.questiongeneration.entity.enums.CompetencyLevel;
import vn.vietduc.carehubbackend.questiongeneration.repository.ExamAttemptRepository;
import vn.vietduc.carehubbackend.user.entity.Department;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.DepartmentRepository;
import vn.vietduc.carehubbackend.user.repository.UserRepository;

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
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompetencyService {

    private final ExamAttemptRepository attemptRepository;
    private final FormSubmissionRepository formSubmissionRepository;
    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final CompetencyClassificationService classificationService;

    @Value("${competency.compliance.default-target:80.0}")
    private double defaultComplianceTarget;

    @Value("${competency.weight.knowledge:0.5}")
    private double knowledgeWeight;

    @Value("${competency.weight.skill:0.5}")
    private double skillWeight;

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

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
            var cat = departmentRepository.findById(categoryId).orElse(null);
            categoryName = cat != null ? cat.getName() : null;
        }

        List<CompetencyByFieldItemResponse> items = new ArrayList<>();
        for (User user : users) {
            List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime);
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
        List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime);

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

            items.add(new vn.vietduc.carehubbackend.questiongeneration.dto.response.KnowledgeCompetencyItemResponse(
                    null, catName, catAttempts.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    level != CompetencyLevel.NOT_COMPETENT
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
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa/phòng"));
        List<User> users = userRepository.findByDepartment_IdInAndIsDeletedFalse(Set.of(departmentId));
        Set<String> employeeCodes = users.stream()
                .map(User::getEmployeeCode)
                .filter(ec -> ec != null && !ec.isBlank())
                .collect(Collectors.toSet());

        List<FormSubmission> allSubmissions = formSubmissionRepository.findAll();

        // Filter submissions matching users in the department
        List<FormSubmission> matched = allSubmissions.stream()
                .filter(s -> s.getStatus() == FormSubmissionStatus.SUBMITTED)
                .filter(s -> s.getSubmittedAt() != null)
                .filter(s -> {
                    java.time.Instant instant = s.getSubmittedAt();
                    LocalDateTime dt = LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault());
                    return !dt.isBefore(fromDateTime) && !dt.isAfter(toDateTime);
                })
                .filter(s -> {
                    // Match by submitter's employee code
                    String ec = s.getSubmittedBy().getEmployeeCode();
                    return ec != null && employeeCodes.contains(ec);
                })
                .filter(s -> {
                    FormSubmissionContext ctx = s.getSubjectContext();
                    if (ctx == null) return true;
                    String ctxEc = ctx.getEmployeeCode();
                    return ctxEc == null || ctxEc.isBlank() || employeeCodes.contains(ctxEc);
                })
                .collect(Collectors.toList());

        if (matched.isEmpty()) {
            String formName = null;
            if (formId != null) {
                var form = foundById(formId);
                formName = form != null ? form.getTitle() : null;
            }
            return new CompetencyByTechniqueResponse(
                    department.getId(), department.getName(),
                    formId, formName, defaultComplianceTarget,
                    from.format(DATE_FMT), to.format(DATE_FMT), List.of()
            );
        }

        // Group by user + form
        Map<String, List<FormSubmission>> grouped = new LinkedHashMap<>();
        for (FormSubmission s : matched) {
            Form form = s.getFormVersion() != null ? s.getFormVersion().getForm() : null;
            if (form == null) continue;
            if (formId != null && !form.getId().equals(formId)) continue;

            String key = s.getSubmittedBy().getId() + ":" + form.getId();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }

        List<CompetencyByTechniqueItemResponse> items = new ArrayList<>();
        for (var entry : grouped.entrySet()) {
            List<FormSubmission> subs = entry.getValue();
            User firstUser = subs.get(0).getSubmittedBy();

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
                    firstUser.getId(), firstUser.getEmployeeCode(), firstUser.getName(),
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
                from.format(DATE_FMT), to.format(DATE_FMT), items
        );
    }

    @Transactional(readOnly = true)
    public CompetencyEmployeeByTechniqueResponse getEmployeeByTechnique(Long employeeId, LocalDate fromDate, LocalDate toDate) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        User user = userRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhân viên"));

        List<FormSubmission> allSubmissions = formSubmissionRepository.findAll();
        List<FormSubmission> matched = allSubmissions.stream()
                .filter(s -> s.getSubmittedBy().getId().equals(user.getId()))
                .filter(s -> s.getStatus() == FormSubmissionStatus.SUBMITTED)
                .filter(s -> s.getSubmittedAt() != null)
                .filter(s -> {
                    java.time.Instant instant = s.getSubmittedAt();
                    LocalDateTime dt = LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault());
                    return !dt.isBefore(fromDateTime) && !dt.isAfter(toDateTime);
                })
                .collect(Collectors.toList());

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
            CompetencyLevel level = classificationService.classifyOverall(avg);

            items.add(new vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse(
                    form.getId(), form.getTitle(), subs.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level),
                    level != CompetencyLevel.NOT_COMPETENT
            ));
        }
        items.sort(Comparator.comparing(vn.vietduc.carehubbackend.questiongeneration.dto.response.SkillCompetencyItemResponse::formName));

        return new CompetencyEmployeeByTechniqueResponse(
                user.getId(), user.getName(), user.getEmployeeCode(),
                from.format(DATE_FMT), to.format(DATE_FMT), items
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
        List<User> users = userRepository.findByDepartment_IdInAndIsDeletedFalse(Set.of(departmentId));

        List<CompetencySummaryItemResponse> items = new ArrayList<>();
        for (User user : users) {
            // Knowledge
            List<ExamAttempt> attempts = attemptRepository.findScoredAttemptsByUserAndDateRange(user, fromDateTime, toDateTime);
            BigDecimal knowledgeAvg = null;
            if (!attempts.isEmpty()) {
                BigDecimal kSum = BigDecimal.ZERO;
                for (ExamAttempt a : attempts) kSum = kSum.add(a.getScore());
                knowledgeAvg = kSum.divide(BigDecimal.valueOf(attempts.size()), 2, RoundingMode.HALF_UP);
            }

            // Skills
            List<FormSubmission> allSubmissions = formSubmissionRepository.findAll();
            List<FormSubmission> userSubs = allSubmissions.stream()
                    .filter(s -> s.getSubmittedBy().getId().equals(user.getId()))
                    .filter(s -> s.getStatus() == FormSubmissionStatus.SUBMITTED)
                    .filter(s -> s.getSubmittedAt() != null)
                    .filter(s -> {
                        java.time.Instant instant = s.getSubmittedAt();
                        LocalDateTime dt = LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault());
                        return !dt.isBefore(fromDateTime) && !dt.isAfter(toDateTime);
                    })
                    .collect(Collectors.toList());

            BigDecimal skillAvg = null;
            if (!userSubs.isEmpty()) {
                BigDecimal sSum = BigDecimal.ZERO;
                for (FormSubmission s : userSubs) {
                    sSum = sSum.add(s.getTotalScore() != null ? s.getTotalScore() : BigDecimal.ZERO);
                }
                skillAvg = sSum.divide(BigDecimal.valueOf(userSubs.size()), 2, RoundingMode.HALF_UP);
            }

            // Calculate overall
            BigDecimal overallScore = null;
            if (knowledgeAvg != null && skillAvg != null) {
                overallScore = knowledgeAvg.multiply(BigDecimal.valueOf(knowledgeWeight))
                        .add(skillAvg.multiply(BigDecimal.valueOf(skillWeight)));
            } else if (knowledgeAvg != null) {
                overallScore = knowledgeAvg;
            } else if (skillAvg != null) {
                overallScore = skillAvg;
            }

            CompetencyLevel level = overallScore != null
                    ? classificationService.classifyOverall(overallScore) : null;

            items.add(new CompetencySummaryItemResponse(
                    user.getId(), user.getEmployeeCode(), user.getName(),
                    knowledgeAvg, skillAvg, overallScore,
                    level != null ? level.name() : null,
                    level != null ? QuestionGenerationLabels.competencyLevel(level) : null,
                    level != null ? QuestionGenerationLabels.competencyLevelColor(level) : null,
                    level != null && level != CompetencyLevel.NOT_COMPETENT
            ));
        }

        items.sort(Comparator.comparing(CompetencySummaryItemResponse::employeeName));

        return new CompetencySummaryResponse(
                department.getId(), department.getName(),
                from.format(DATE_FMT), to.format(DATE_FMT),
                BigDecimal.valueOf(knowledgeWeight), BigDecimal.valueOf(skillWeight),
                items
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

    private Form foundById(Long formId) {
        return formSubmissionRepository.findAll().stream()
                .map(s -> s.getFormVersion() != null ? s.getFormVersion().getForm() : null)
                .filter(f -> f != null && f.getId().equals(formId))
                .findFirst().orElse(null);
    }
}
