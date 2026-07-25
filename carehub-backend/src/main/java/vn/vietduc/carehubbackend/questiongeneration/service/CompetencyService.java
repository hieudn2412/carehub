package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
    private static final String ALL_DEPARTMENTS_LABEL = "Toàn viện";

    @Transactional(readOnly = true)
    public CompetencyByFieldResponse getByField(
            Long departmentId,
            Long categoryId,
            LocalDate fromDate,
            LocalDate toDate,
            String keyword,
            Pageable pageable
    ) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        Department department = findDepartment(departmentId);

        String categoryName = null;
        String categoryFilter = categoryId != null ? String.valueOf(categoryId) : null;
        if (categoryId != null) {
            var cat = questionCategoryRepository.findById(categoryId).orElse(null);
            categoryName = cat != null ? cat.getName() : null;
        }

        Page<User> userPage = userRepository.findCompetencyFieldCandidates(
                departmentId,
                normalizeKeyword(keyword),
                categoryFilter,
                fromDateTime,
                toDateTime,
                normalizePageable(pageable)
        );
        List<User> users = userPage.getContent();
        Map<Long, List<ExamAttempt>> attemptsByUser = users.isEmpty()
                ? Map.of()
                : groupAttemptsByUser(attemptRepository.findScoredAttemptsByUserIdsAndDateRange(
                        userIds(users), fromDateTime, toDateTime
                ));

        List<CompetencyByFieldItemResponse> items = new ArrayList<>();
        for (User user : users) {
            List<ExamAttempt> attempts = attemptsByUser.getOrDefault(user.getId(), List.of())
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
                    departmentName(user),
                    attempts.size(), avg, passCount, passRate,
                    level.name(), QuestionGenerationLabels.competencyLevel(level),
                    QuestionGenerationLabels.competencyLevelColor(level), isPassed
            ));
        }

        items.sort(Comparator.comparing(CompetencyByFieldItemResponse::employeeName));

        return new CompetencyByFieldResponse(
                departmentId, scopeName(department),
                categoryId, categoryName,
                from.format(DATE_FMT), to.format(DATE_FMT), items,
                userPage.getNumber(), userPage.getSize(),
                userPage.getTotalElements(), userPage.getTotalPages()
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
    public CompetencyByTechniqueResponse getByTechnique(
            Long departmentId,
            Long formId,
            LocalDate fromDate,
            LocalDate toDate,
            String keyword,
            Pageable pageable
    ) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        ZoneId zoneId = ZoneId.systemDefault();

        Department department = findDepartment(departmentId);
        java.time.Instant fromInstant = from.atStartOfDay(zoneId).toInstant();
        java.time.Instant toInstant = to.plusDays(1).atStartOfDay(zoneId).toInstant().minusNanos(1);
        Page<User> userPage = formSubmissionRepository.findCompetencyTechniqueCandidates(
                departmentId,
                formId,
                normalizeKeyword(keyword),
                fromInstant,
                toInstant,
                normalizePageable(pageable)
        );
        List<User> users = userPage.getContent();
        List<CompetencyTechniqueOptionResponse> forms =
                formSubmissionRepository.findCompetencyTechniqueOptions(
                        departmentId, fromInstant, toInstant
                );
        List<FormSubmission> matched = users.isEmpty()
                ? List.of()
                : formSubmissionRepository.findScoredEvaluationsForTechniqueCandidates(
                        userIds(users), formId, fromInstant, toInstant
                );
        Map<Long, List<FormSubmission>> grouped = matched.stream()
                .filter(submission -> submission.getSubjectContext() != null)
                .filter(submission -> submission.getSubjectContext().getSubjectUser() != null)
                .collect(Collectors.groupingBy(
                        submission -> submission.getSubjectContext().getSubjectUser().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<CompetencyByTechniqueItemResponse> items = new ArrayList<>();
        for (User subject : users) {
            List<FormSubmission> subs = grouped.getOrDefault(subject.getId(), List.of());
            if (subs.isEmpty()) {
                continue;
            }

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
                    departmentName(subject),
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
                departmentId, scopeName(department),
                formId, formName, defaultComplianceTarget,
                from.format(DATE_FMT), to.format(DATE_FMT), forms, items,
                userPage.getNumber(), userPage.getSize(),
                userPage.getTotalElements(), userPage.getTotalPages()
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
    public CompetencySummaryResponse getSummary(
            Long departmentId,
            LocalDate fromDate,
            LocalDate toDate,
            String keyword,
            Pageable pageable
    ) {
        LocalDate from = fromDate != null ? fromDate : LocalDate.of(LocalDate.now().getYear(), 1, 1);
        LocalDate to = toDate != null ? toDate : LocalDate.now();
        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        Department department = findDepartment(departmentId);
        BigDecimal targetScore = department != null
                ? normalizeTargetScore(department.getCompetencyTargetScore())
                : null;
        Page<User> userPage = userRepository.findCompetencySummaryCandidates(
                departmentId,
                normalizeKeyword(keyword),
                normalizePageable(pageable)
        );
        List<User> users = userPage.getContent();
        Map<Long, List<ExamAttempt>> attemptsByUser = users.isEmpty()
                ? Map.of()
                : groupAttemptsByUser(attemptRepository.findScoredAttemptsByUserIdsAndDateRange(
                        userIds(users), fromDateTime, toDateTime
                ));
        ZoneId zoneId = ZoneId.systemDefault();
        Map<Long, List<FormSubmission>> allSubmissionsByUser = new LinkedHashMap<>();
        Map<String, List<FormSubmission>> legacySubmissionsByEmployeeCode = new LinkedHashMap<>();
        if (!users.isEmpty()) {
            List<String> employeeCodes = users.stream()
                    .map(User::getEmployeeCode)
                    .map(this::normalizeEmployeeCode)
                    .filter(java.util.Objects::nonNull)
                    .toList();
            List<FormSubmission> allSubmissions =
                    formSubmissionRepository.findScoredEvaluationsForCandidateUsers(
                    userIds(users),
                    employeeCodes.isEmpty() ? List.of("__none__") : employeeCodes,
                    fromDateTime.atZone(zoneId).toInstant(),
                    toDateTime.atZone(zoneId).toInstant()
            );
            for (FormSubmission submission : allSubmissions) {
                if (submission.getSubjectContext() == null) {
                    continue;
                }
                User subject = submission.getSubjectContext().getSubjectUser();
                if (subject != null) {
                    allSubmissionsByUser.computeIfAbsent(subject.getId(), ignored -> new ArrayList<>())
                            .add(submission);
                } else {
                    String employeeCode = normalizeEmployeeCode(
                            submission.getSubjectContext().getEmployeeCode()
                    );
                    if (employeeCode != null) {
                        legacySubmissionsByEmployeeCode
                                .computeIfAbsent(employeeCode, ignored -> new ArrayList<>())
                                .add(submission);
                    }
                }
            }
        }

        List<CompetencySummaryItemResponse> items = new ArrayList<>();
        for (User user : users) {
            // Knowledge
            List<ExamAttempt> attempts = attemptsByUser.getOrDefault(user.getId(), List.of())
                    .stream()
                    .filter(attempt -> attempt.getScore() != null)
                    .toList();
            BigDecimal knowledgeAvg = null;
            if (!attempts.isEmpty()) {
                BigDecimal kSum = BigDecimal.ZERO;
                for (ExamAttempt a : attempts) {
                    BigDecimal attemptScore = a.getScore() != null ? a.getScore() : BigDecimal.ZERO;
                    if (attemptScore.compareTo(BigDecimal.valueOf(10)) > 0) {
                        attemptScore = attemptScore.divide(BigDecimal.valueOf(10), 2, RoundingMode.HALF_UP);
                    }
                    kSum = kSum.add(attemptScore);
                }
                knowledgeAvg = kSum.divide(BigDecimal.valueOf(attempts.size()), 2, RoundingMode.HALF_UP);
            }

            // Skills
            List<FormSubmission> userSubs = allSubmissionsByUser.get(user.getId());
            if (userSubs == null || userSubs.isEmpty()) {
                userSubs = legacySubmissionsByEmployeeCode.getOrDefault(
                        normalizeEmployeeCode(user.getEmployeeCode()),
                        List.of()
                );
            }

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
            BigDecimal employeeTargetScore = departmentId != null
                    ? targetScore
                    : normalizeTargetScore(user.getDepartment() != null
                            ? user.getDepartment().getCompetencyTargetScore()
                            : null);

            items.add(new CompetencySummaryItemResponse(
                    user.getId(), user.getEmployeeCode(), user.getName(),
                    departmentName(user),
                    knowledgeAvg, skillAvg, overallScore,
                    level != null ? level.name() : null,
                    level != null ? QuestionGenerationLabels.competencyLevel(level) : null,
                    level != null ? QuestionGenerationLabels.competencyLevelColor(level) : null,
                    overallScore != null
                            && employeeTargetScore != null
                            && overallScore.compareTo(employeeTargetScore) > 0
            ));
        }

        items.sort(Comparator.comparing(CompetencySummaryItemResponse::employeeName));

        return new CompetencySummaryResponse(
                departmentId, scopeName(department),
                from.format(DATE_FMT), to.format(DATE_FMT),
                SUMMARY_WEIGHT, SUMMARY_WEIGHT,
                targetScore,
                items,
                userPage.getNumber(), userPage.getSize(),
                userPage.getTotalElements(), userPage.getTotalPages()
        );
    }

    private Department findDepartment(Long departmentId) {
        if (departmentId == null) {
            return null;
        }
        return departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khoa/phòng"));
    }

    private String scopeName(Department department) {
        return department != null ? department.getName() : ALL_DEPARTMENTS_LABEL;
    }

    private String departmentName(User user) {
        return user.getDepartment() != null ? user.getDepartment().getName() : null;
    }

    private BigDecimal normalizeTargetScore(BigDecimal targetScore) {
        if (targetScore != null && targetScore.compareTo(BigDecimal.valueOf(10)) > 0) {
            return targetScore.divide(BigDecimal.valueOf(10), 2, RoundingMode.HALF_UP);
        }
        return targetScore;
    }

    private Map<Long, List<ExamAttempt>> groupAttemptsByUser(List<ExamAttempt> attempts) {
        return attempts.stream()
                .filter(attempt -> attempt.getUser() != null)
                .collect(Collectors.groupingBy(
                        attempt -> attempt.getUser().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
    }

    private Pageable normalizePageable(Pageable pageable) {
        int page = pageable != null ? Math.max(0, pageable.getPageNumber()) : 0;
        int requestedSize = pageable != null ? pageable.getPageSize() : 10;
        int size = Math.min(Math.max(requestedSize, 1), 100);
        return PageRequest.of(page, size);
    }

    private List<Long> userIds(List<User> users) {
        return users.stream().map(User::getId).toList();
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return null;
        }
        return "%" + keyword.trim().toLowerCase(java.util.Locale.ROOT) + "%";
    }

    private String normalizeEmployeeCode(String employeeCode) {
        if (employeeCode == null || employeeCode.isBlank()) {
            return null;
        }
        return employeeCode.trim().toLowerCase(java.util.Locale.ROOT);
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
            return submission.getConvertedScore().setScale(2, RoundingMode.HALF_UP);
        }
        if (submission.getTotalScore() != null
                && submission.getMaxScore() != null
                && submission.getMaxScore().compareTo(BigDecimal.ZERO) > 0) {
            return submission.getTotalScore()
                    .multiply(BigDecimal.valueOf(10))
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
