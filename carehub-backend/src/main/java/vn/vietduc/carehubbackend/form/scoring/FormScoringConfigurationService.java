package vn.vietduc.carehubbackend.form.scoring;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vietduc.carehubbackend.exception.*;
import vn.vietduc.carehubbackend.form.dto.request.*;
import vn.vietduc.carehubbackend.form.dto.response.*;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.service.FormSchemaSnapshotService;
import vn.vietduc.carehubbackend.form.submission.entity.FormSubmissionStatus;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.user.entity.User;
import vn.vietduc.carehubbackend.user.repository.UserRepository;
import vn.vietduc.carehubbackend.utils.SecurityUtils;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FormScoringConfigurationService {
    private static final int MAX_PAGE_SIZE = 100;
    private final FormVersionRepository versionRepository;
    private final FormSubmissionRepository submissionRepository;
    private final FormScoringPolicy scoringPolicy;
    private final FormSchemaSnapshotService schemaSnapshotService;
    private final FormScoringRecalculationJobService jobService;
    private final SecurityUtils securityUtils;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<FormScoringConfigurationResponse> search(String keyword, FormVersionStatus status,
                                                         Pageable pageable) {
        Page<FormVersion> versions = versionRepository.searchScoringConfigurations(
                keyword == null ? "" : keyword.trim(), status, normalize(pageable));
        return versions.map(version -> toResponse(version, null));
    }

    @Transactional
    public UpdateFormScoringConfigurationResponse update(Long formId, Long versionId,
                                                          UpdateFormScoringConfigurationRequest request) {
        FormVersion version = versionRepository.findByIdAndFormIdForUpdate(formId, versionId)
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
        if (!Objects.equals(version.getLockVersion(), request.lockVersion())) {
            throw new ConflictException("Form version has been updated by another user");
        }

        boolean criticalChanged = request.criticalWeightPercent() != null
                && scoringPolicy.criticalWeightPercent(version)
                .compareTo(BigDecimal.valueOf(request.criticalWeightPercent())) != 0;
        if (criticalChanged && version.getStatus() != FormVersionStatus.DRAFT) {
            throw new ConflictException("Critical weight percentage can only be changed on a draft version");
        }
        if (criticalChanged) {
            scoringPolicy.setCriticalWeightPercent(version,
                    BigDecimal.valueOf(request.criticalWeightPercent()));
            schemaSnapshotService.update(version);
        }

        PassingScoreConfigurationRequest passingScore = request.passingScore();
        BigDecimal targetOverride = passingScore == null || passingScore.mode() == PassingScoreMode.DEFAULT
                ? null : passingScore.value();
        boolean passingChanged = passingScore != null
                && !same(version.getPassingScoreOverride(), targetOverride);

        if (version.getStatus() == FormVersionStatus.DRAFT) {
            if (passingScore != null) version.setPassingScoreOverride(targetOverride);
            FormVersion saved = versionRepository.saveAndFlush(version);
            return UpdateFormScoringConfigurationResponse.builder()
                    .configuration(toResponse(saved, null))
                    .recalculationScheduled(false)
                    .build();
        }

        if (!passingChanged) {
            return UpdateFormScoringConfigurationResponse.builder()
                    .configuration(toResponse(version, null))
                    .recalculationScheduled(false)
                    .build();
        }

        FormScoringRecalculationJob job = jobService.create(version,
                targetOverride == null ? PassingScoreMode.DEFAULT : PassingScoreMode.CUSTOM,
                targetOverride, currentUser());
        return UpdateFormScoringConfigurationResponse.builder()
                .configuration(toResponse(version, job))
                .job(jobService.toResponse(job))
                .recalculationScheduled(true)
                .build();
    }

    public FormScoringConfigurationResponse toResponse(FormVersion version,
                                                       FormScoringRecalculationJob suppliedJob) {
        FormScoringPolicy.Definition definition = scoringPolicy.resolve(version);
        FormScoringRecalculationJob latest = suppliedJob != null ? suppliedJob
                : jobService.latest(version.getId()).orElse(null);
        FormScoringPolicy.GroupWeights groupWeights = scoringPolicy.effectiveGroupWeights(version);
        return FormScoringConfigurationResponse.builder()
                .formId(version.getForm().getId())
                .formCode(version.getForm().getCode())
                .formTitle(version.getForm().getTitle())
                .versionId(version.getId())
                .versionNumber(version.getVersionNumber())
                .versionTitle(version.getTitle())
                .versionStatus(version.getStatus())
                .criticalWeightPercent(groupWeights.critical())
                .normalWeightPercent(groupWeights.normal())
                .passingScoreMode(version.getPassingScoreOverride() == null
                        ? PassingScoreMode.DEFAULT : PassingScoreMode.CUSTOM)
                .passingScore(definition.configured() ? definition.effectivePassingScore() : null)
                .passingScoreOverride(version.getPassingScoreOverride())
                .submittedCount(submissionRepository.countByFormVersion_IdAndStatus(
                        version.getId(), FormSubmissionStatus.SUBMITTED))
                .canEditCriticalWeight(version.getStatus() == FormVersionStatus.DRAFT)
                .canEditPassingScore(true)
                .lockVersion(version.getLockVersion())
                .latestJob(latest == null ? null : jobService.toResponse(latest))
                .updatedAt(version.getUpdatedAt())
                .build();
    }

    private boolean same(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) return left == null && right == null;
        return left.compareTo(right) == 0;
    }

    private User currentUser() {
        Long userId;
        try {
            userId = securityUtils.getCurrentUserId();
        } catch (RuntimeException ex) {
            throw new UnauthorizedException("Authenticated user is required");
        }
        return userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Người dùng đã xác thực không còn tồn tại"));
    }

    private Pageable normalize(Pageable pageable) {
        if (pageable.getPageSize() < 1 || pageable.getPageSize() > MAX_PAGE_SIZE) {
            throw ValidationException.field("size", "Page size must be between 1 and " + MAX_PAGE_SIZE);
        }
        Map<String, String> allowed = Map.of(
                "formTitle", "form.title",
                "versionNumber", "versionNumber",
                "status", "status",
                "updatedAt", "updatedAt"
        );
        Sort sort = pageable.getSort().isSorted()
                ? Sort.by(pageable.getSort().stream().map(order -> {
                    String property = allowed.get(order.getProperty());
                    if (property == null) throw ValidationException.field(
                            "sort", "Unsupported sort field: " + order.getProperty());
                    return new Sort.Order(order.getDirection(), property);
                }).toList())
                : Sort.by(Sort.Order.desc("updatedAt"));
        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
    }
}
