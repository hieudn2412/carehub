package vn.vietduc.carehubbackend.form.submission.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.*;
import vn.vietduc.carehubbackend.form.assignment.entity.FormAssignmentItem;
import vn.vietduc.carehubbackend.form.assignment.service.FormAssignmentAccessService;
import vn.vietduc.carehubbackend.form.entity.*;
import vn.vietduc.carehubbackend.form.entity.enums.*;
import vn.vietduc.carehubbackend.form.repository.FormRepository;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.submission.dto.*;
import vn.vietduc.carehubbackend.form.submission.entity.*;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.notification.entity.NotificationAudience;
import vn.vietduc.carehubbackend.notification.entity.NotificationEventType;
import vn.vietduc.carehubbackend.notification.messaging.NotificationDispatchEvent;
import vn.vietduc.carehubbackend.notification.messaging.NotificationEventPublisher;
import vn.vietduc.carehubbackend.notification.service.NotificationVariableFormatter;
import vn.vietduc.carehubbackend.user.entity.*;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.math.*;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FormSubmissionService {
    private static final int MAX_PAGE_SIZE = 100;
    private final FormSubmissionRepository submissionRepository;
    private final FormAssignmentAccessService assignmentAccessService;
    private final FormRepository formRepository;
    private final FormVersionRepository versionRepository;
    private final UserRepository userRepository;
    private final SecurityUtils securityUtils;
    private final FormScoreCalculator scoreCalculator;
    private final EntityManager entityManager;
    private final Clock clock;
    private final NotificationEventPublisher notificationEventPublisher;
    private final NotificationVariableFormatter notificationVariableFormatter;

    @Transactional
    public FormSubmissionResponse create(CreateFormSubmissionRequest request) {
        long actorId = securityUtils.getCurrentUserId();
        User actor = activeUser(actorId);
        FormAssignmentItem item = assignmentAccessService.requireActiveOwnedItemForUpdate(request.assignmentItemId(), actorId);
        if (item.getForm().getSubjectType() != FormSubjectType.USER
                || request.subject().type() != FormSubjectType.USER) {
            throw ValidationException.field("subject.type", "This assigned form requires a USER subject");
        }
        User subject = userRepository.findByEmployeeCodeIgnoreCaseAndIsDeletedFalse(request.subject().employeeCode().trim())
                .orElseThrow(() -> new ResourceNotFoundException("Form subject user not found"));
        if (submissionRepository.existsByAssignmentItem_IdAndSubmittedBy_IdAndSubjectContext_SubjectUser_IdAndStatus(
                item.getId(), actorId, subject.getId(), FormSubmissionStatus.DRAFT)) {
            throw new ConflictException("An open draft already exists for this employee and assigned form");
        }

        FormSubmission submission = FormSubmission.builder().assignmentItem(item).formVersion(item.getFormVersion())
                .submittedBy(actor).status(FormSubmissionStatus.DRAFT)
                .scoringStatus(FormScoringStatus.NOT_CONFIGURED).build();
        FormSubmissionContext context = FormSubmissionContext.builder().submission(submission)
                .subjectType(FormSubjectType.USER).subjectUser(subject).employeeCode(subject.getEmployeeCode())
                .fullName(subject.getName()).position(subject.getPosition() == null ? null : subject.getPosition().getName())
                .department(subject.getDepartment() == null ? null : subject.getDepartment().getName()).build();
        submission.setSubjectContext(context);
        return toResponse(submissionRepository.saveAndFlush(submission), true);
    }

    @Transactional
    public FormSubmissionResponse update(Long id, UpdateFormSubmissionRequest request) {
        FormSubmission submission = ownedDraft(id);
        requireLock(submission, request.lockVersion());
        Map<UUID, FormQuestion> questions = questions(submission.getFormVersion());
        Set<UUID> seen = new HashSet<>();
        List<FormAnswer> replacement = new ArrayList<>();
        for (int index = 0; index < request.answers().size(); index++) {
            UpdateFormSubmissionRequest.AnswerRequest answerRequest = request.answers().get(index);
            if (!seen.add(answerRequest.questionKey())) {
                throw ValidationException.field("answers[" + index + "].questionKey", "Question may only be answered once");
            }
            FormQuestion question = questions.get(answerRequest.questionKey());
            if (question == null) {
                throw ValidationException.field("answers[" + index + "].questionKey", "Question does not belong to this form version");
            }
            if (question.isReadOnly()) {
                throw ValidationException.field("answers[" + index + "].questionKey", "Read-only questions cannot be answered");
            }
            replacement.add(toAnswer(submission, question, answerRequest, index));
        }

        submission.getAnswers().clear();
        submissionRepository.saveAndFlush(submission);
        entityManager.flush();
        submission.getAnswers().addAll(replacement);
        clearScore(submission);
        return toResponse(submissionRepository.saveAndFlush(submission), true);
    }

    @Transactional
    public FormSubmissionResponse submit(Long id, SubmitFormSubmissionRequest request) {
        FormSubmission submission = ownedDraft(id);
        requireLock(submission, request.lockVersion());
        validateRequiredAnswers(submission);
        FormScoreCalculator.ScoreResult score = scoreCalculator.calculate(submission.getFormVersion(), submission.getAnswers());
        applyScore(submission, score);
        submission.setStatus(FormSubmissionStatus.SUBMITTED);
        submission.setSubmittedAt(Instant.now(clock));
        FormSubmission saved = submissionRepository.saveAndFlush(submission);
        publishPersonalComplianceIssue(saved);
        return toResponse(saved, true);
    }

    private void publishPersonalComplianceIssue(FormSubmission submission) {
        if (submission.getResult() != FormSubmissionResult.FAILED_SCORE
                && submission.getResult() != FormSubmissionResult.FAILED_CRITICAL) {
            return;
        }
        FormSubmissionContext context = submission.getSubjectContext();
        User employee = context == null ? null : context.getSubjectUser();
        if (employee == null) {
            return;
        }
        String formName = submission.getAssignmentItem().getForm().getTitle();
        BigDecimal displayedScore = submission.getConvertedScore() == null
                ? submission.getTotalScore()
                : submission.getConvertedScore();
        Map<String, String> variables = new LinkedHashMap<>();
        variables.put("employee_name", employee.getName());
        variables.put("employee_code", employee.getEmployeeCode());
        variables.put("form_name", formName);
        variables.put("result", submission.getResult().name());
        variables.put("score", notificationVariableFormatter.formatScore(displayedScore));
        variables.put("submitted_at", notificationVariableFormatter.formatDateTime(submission.getSubmittedAt()));
        notificationEventPublisher.publish(new NotificationDispatchEvent(
                NotificationEventType.PERSONAL_COMPLIANCE_ISSUE,
                employee.getId(),
                NotificationAudience.EMPLOYEE,
                "WARNING",
                "Kết quả tuân thủ cần lưu ý",
                "Kết quả đánh giá '" + formName + "' của bạn chưa đạt yêu cầu.",
                null,
                "PERSONAL_COMPLIANCE:" + submission.getId(),
                variables
        ));
    }

    @Transactional
    public void cancel(Long id) {
        FormSubmission submission = ownedDraft(id);
        submission.setStatus(FormSubmissionStatus.VOIDED);
        submissionRepository.save(submission);
    }

    @Transactional(readOnly = true)
    public Page<FormSubmissionResponse> search(FormSubmissionStatus status, Pageable pageable) {
        Pageable normalized = normalize(pageable);
        Page<FormSubmission> page = isAdmin()
                ? submissionRepository.searchAll(status, normalized)
                : submissionRepository.searchOwned(securityUtils.getCurrentUserId(), status, normalized);
        return page.map(submission -> toResponse(submission, false));
    }

    @Transactional(readOnly = true)
    public Page<FormSubmissionResponse> searchByForm(Long formId, FormSubmissionStatus status,
                                                     boolean includeAnswers, Pageable pageable) {
        formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        return submissionRepository.searchByFormId(formId, status, normalize(pageable))
                .map(submission -> toResponse(submission, includeAnswers));
    }

    @Transactional(readOnly = true)
    public Page<FormSubmissionResponse> searchByFormVersion(Long formId, Long versionId, FormSubmissionStatus status,
                                                            boolean includeAnswers, Pageable pageable) {
        formRepository.findByIdAndDeletedFalse(formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form not found"));
        versionRepository.findByIdAndForm_Id(versionId, formId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
        return submissionRepository.searchByFormVersionId(formId, versionId, status, normalize(pageable))
                .map(submission -> toResponse(submission, includeAnswers));
    }

    @Transactional(readOnly = true)
    public FormSubmissionResponse get(Long id) {
        FormSubmission submission = submissionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Form submission not found"));
        if (!isAdmin() && !submission.getSubmittedBy().getId().equals(securityUtils.getCurrentUserId())) {
            throw new ResourceNotFoundException("Form submission not found");
        }
        return toResponse(submission, true);
    }

    private FormSubmission ownedDraft(Long id) {
        long actorId = securityUtils.getCurrentUserId();
        FormSubmission submission = submissionRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Form submission not found"));
        if (!submission.getSubmittedBy().getId().equals(actorId)) {
            throw new ResourceNotFoundException("Form submission not found");
        }
        assignmentAccessService.requireActiveOwnedItem(submission.getAssignmentItem().getId(), actorId);
        if (submission.getStatus() != FormSubmissionStatus.DRAFT) {
            throw new ConflictException("Only a draft submission can be modified");
        }
        return submission;
    }

    private FormAnswer toAnswer(FormSubmission submission, FormQuestion question,
                                UpdateFormSubmissionRequest.AnswerRequest request, int index) {
        Map<String, Object> value = new LinkedHashMap<>();
        FormOption selected = null;
        switch (question.getFieldType()) {
            case SINGLE_CHOICE, DROPDOWN -> {
                if (request.optionKey() == null) {
                    throw ValidationException.field("answers[" + index + "].optionKey", "An option is required");
                }
                selected = option(question, request.optionKey(), index);
                value.put("optionKey", selected.getOptionKey().toString());
                value.put("value", selected.getValue());
                value.put("label", selected.getLabel());
            }
            case MULTIPLE_CHOICE -> {
                if (request.optionKeys() == null || request.optionKeys().isEmpty()) {
                    throw ValidationException.field("answers[" + index + "].optionKeys", "At least one option is required");
                }
                List<FormOption> options = request.optionKeys().stream().distinct()
                        .map(key -> option(question, key, index)).toList();
                value.put("optionKeys", options.stream().map(o -> o.getOptionKey().toString()).toList());
                value.put("values", options.stream().map(FormOption::getValue).toList());
                value.put("labels", options.stream().map(FormOption::getLabel).toList());
            }
            case NUMBER, LINEAR_SCALE -> {
                if (request.numberValue() == null) throw requiredValue(index, "numberValue");
                value.put("numberValue", request.numberValue());
            }
            case DATE -> {
                if (request.dateValue() == null) throw requiredValue(index, "dateValue");
                value.put("dateValue", request.dateValue().toString());
            }
            case TIME -> {
                if (request.timeValue() == null) throw requiredValue(index, "timeValue");
                value.put("timeValue", request.timeValue().toString());
            }
            default -> {
                if (request.textValue() == null || request.textValue().isBlank()) throw requiredValue(index, "textValue");
                value.put("textValue", request.textValue().trim());
            }
        }
        return FormAnswer.builder().submission(submission).question(question).selectedOption(selected)
                .answerJson(value).critical(question.isCritical()).excludedFromScore(question.isExcludeFromScore()).build();
    }

    private ValidationException requiredValue(int index, String field) {
        return ValidationException.field("answers[" + index + "]." + field, "Answer value is required");
    }

    private FormOption option(FormQuestion question, UUID optionKey, int index) {
        return question.getOptions().stream().filter(FormOption::isActive)
                .filter(option -> option.getOptionKey().equals(optionKey)).findFirst()
                .orElseThrow(() -> ValidationException.field("answers[" + index + "].optionKey",
                        "Option does not belong to this question"));
    }

    private Map<UUID, FormQuestion> questions(FormVersion version) {
        return version.getSections().stream().flatMap(section -> section.getQuestions().stream())
                .filter(question -> question.getItemType() == FormItemType.QUESTION)
                .collect(Collectors.toMap(FormQuestion::getQuestionKey, Function.identity()));
    }

    private void validateRequiredAnswers(FormSubmission submission) {
        Set<Long> answered = submission.getAnswers().stream().map(a -> a.getQuestion().getId()).collect(Collectors.toSet());
        List<String> missing = questions(submission.getFormVersion()).values().stream()
                .filter(FormQuestion::isRequired).filter(q -> !answered.contains(q.getId()))
                .map(FormQuestion::getCode).toList();
        if (!missing.isEmpty()) throw ValidationException.field("answers", "Required questions are missing: " + String.join(", ", missing));
    }

    private void applyScore(FormSubmission submission, FormScoreCalculator.ScoreResult score) {
        submission.setScoringStatus(score.scoringStatus());
        submission.setResult(score.result());
        submission.setTotalScore(score.totalScore());
        submission.setMaxScore(score.maxScore());
        submission.setPassingScore(score.passingScore());
        submission.setConvertedScore(score.convertedScore());
        submission.setCriticalFailure(score.criticalFailure());
        submission.setScoreBreakdown(Map.of("questions", score.breakdown().stream().map(this::breakdownMap).toList()));
    }

    private Map<String, Object> breakdownMap(FormScoreCalculator.Breakdown item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("questionKey", item.questionKey().toString());
        map.put("code", item.code());
        map.put("title", item.title());
        map.put("critical", item.critical());
        map.put("baseScore", item.baseScore());
        map.put("weight", item.weight());
        map.put("weightedScore", item.weightedScore());
        map.put("maxScore", item.maxScore());
        return map;
    }

    private void clearScore(FormSubmission submission) {
        submission.setScoringStatus(FormScoringStatus.NOT_CONFIGURED);
        submission.setResult(null);
        submission.setTotalScore(null);
        submission.setMaxScore(null);
        submission.setPassingScore(null);
        submission.setConvertedScore(null);
        submission.setCriticalFailure(false);
        submission.setScoreBreakdown(null);
    }

    private void requireLock(FormSubmission submission, Long lockVersion) {
        if (!Objects.equals(submission.getLockVersion(), lockVersion)) {
            throw new ConflictException("Form submission has been updated by another request");
        }
    }

    private User activeUser(Long id) {
        return userRepository.findById(id).filter(u -> !u.isDeleted() && u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new UnauthorizedException("Authenticated user no longer exists"));
    }

    private boolean isAdmin() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private FormSubmissionResponse toResponse(FormSubmission submission, boolean detail) {
        FormSubmissionContext context = submission.getSubjectContext();
        return FormSubmissionResponse.builder().id(submission.getId())
                .assignmentItemId(submission.getAssignmentItem().getId())
                .formId(submission.getFormVersion().getForm().getId())
                .formCode(submission.getFormVersion().getForm().getCode())
                .formVersionId(submission.getFormVersion().getId())
                .versionNumber(submission.getFormVersion().getVersionNumber()).title(submission.getFormVersion().getTitle())
                .status(submission.getStatus()).subject(FormSubmissionResponse.SubjectSnapshot.builder()
                        .type(context.getSubjectType()).employeeCode(context.getEmployeeCode()).fullName(context.getFullName())
                        .position(context.getPosition()).department(context.getDepartment()).build())
                .scoringStatus(submission.getScoringStatus()).result(submission.getResult())
                .totalScore(display(submission.getTotalScore())).maxScore(display(submission.getMaxScore()))
                .passingScore(display(submission.getPassingScore())).convertedScore(display(submission.getConvertedScore()))
                .criticalFailure(submission.isCriticalFailure())
                .scoreBreakdown(detail ? scoreBreakdown(submission) : List.of())
                .answers(detail ? submission.getAnswers().stream().map(a -> FormSubmissionResponse.AnswerResponse.builder()
                        .questionKey(a.getQuestion().getQuestionKey())
                        .optionKey(a.getSelectedOption() == null ? null : a.getSelectedOption().getOptionKey())
                        .value(a.getAnswerJson()).build()).toList() : List.of())
                .lockVersion(submission.getLockVersion()).createdAt(submission.getCreatedAt())
                .updatedAt(submission.getUpdatedAt()).submittedAt(submission.getSubmittedAt()).build();
    }

    private List<FormSubmissionResponse.ScoreBreakdown> scoreBreakdown(FormSubmission submission) {
        if (submission.getScoringStatus() != FormScoringStatus.CALCULATED
                || submission.getScoreBreakdown() == null
                || !(submission.getScoreBreakdown().get("questions") instanceof List<?> questions)) {
            return List.of();
        }
        return questions.stream().filter(Map.class::isInstance).map(Map.class::cast).map(item ->
                FormSubmissionResponse.ScoreBreakdown.builder()
                        .questionKey(UUID.fromString(String.valueOf(item.get("questionKey"))))
                        .code(String.valueOf(item.get("code"))).title(String.valueOf(item.get("title")))
                        .critical(Boolean.parseBoolean(String.valueOf(item.get("critical"))))
                        .baseScore(display(decimal(item.get("baseScore")))).weight(display(decimal(item.get("weight"))))
                        .weightedScore(display(decimal(item.get("weightedScore"))))
                        .maxScore(display(decimal(item.get("maxScore")))).build()).toList();
    }

    private BigDecimal decimal(Object value) {
        return value == null ? null : new BigDecimal(String.valueOf(value));
    }

    private BigDecimal display(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }

    private Pageable normalize(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("createdAt").descending());
    }
}
