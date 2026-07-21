package vn.vietduc.carehubbackend.form.scoring;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import vn.vietduc.carehubbackend.exception.*;
import vn.vietduc.carehubbackend.form.dto.response.FormScoringRecalculationJobResponse;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;
import vn.vietduc.carehubbackend.user.entity.User;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FormScoringRecalculationJobService {
    private static final Set<FormScoringRecalculationStatus> ACTIVE_STATUSES = Set.of(
            FormScoringRecalculationStatus.PENDING, FormScoringRecalculationStatus.RUNNING);

    private final FormScoringRecalculationJobRepository jobRepository;
    private final FormVersionRepository versionRepository;
    private final FormSubmissionRepository submissionRepository;
    private final FormScoringPolicy scoringPolicy;
    private final ApplicationEventPublisher eventPublisher;

    public FormScoringRecalculationJob create(FormVersion version, PassingScoreMode targetMode,
                                              BigDecimal targetPassingScore, User requestedBy) {
        if (jobRepository.existsByFormVersion_IdAndStatusIn(version.getId(), ACTIVE_STATUSES)) {
            throw new ConflictException("Phiên bản đang có tác vụ tính lại điểm chưa hoàn tất");
        }
        FormScoringRecalculationJob job = jobRepository.save(FormScoringRecalculationJob.builder()
                .formVersion(version)
                .status(FormScoringRecalculationStatus.PENDING)
                .targetMode(targetMode)
                .targetPassingScore(targetMode == PassingScoreMode.CUSTOM ? targetPassingScore : null)
                .previousMode(version.getPassingScoreOverride() == null
                        ? PassingScoreMode.DEFAULT : PassingScoreMode.CUSTOM)
                .previousPassingScore(version.getPassingScoreOverride())
                .requestedBy(requestedBy)
                .build());
        eventPublisher.publishEvent(new FormScoringRecalculationRequestedEvent(job.getId()));
        return job;
    }

    @Transactional(readOnly = true)
    public FormScoringRecalculationJobResponse get(Long jobId) {
        return toResponse(find(jobId));
    }

    @Transactional
    public FormScoringRecalculationJobResponse retry(Long jobId) {
        FormScoringRecalculationJob job = jobRepository.findByIdForUpdate(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Scoring recalculation job not found"));
        if (job.getStatus() != FormScoringRecalculationStatus.FAILED) {
            throw new ConflictException("Only a failed scoring recalculation job can be retried");
        }
        if (jobRepository.existsByFormVersion_IdAndStatusIn(job.getFormVersion().getId(), ACTIVE_STATUSES)) {
            throw new ConflictException("Phiên bản đang có tác vụ tính lại điểm chưa hoàn tất");
        }
        job.setStatus(FormScoringRecalculationStatus.PENDING);
        job.setStartedAt(null);
        job.setCompletedAt(null);
        job.setErrorMessage(null);
        FormScoringRecalculationJob saved = jobRepository.save(job);
        eventPublisher.publishEvent(new FormScoringRecalculationRequestedEvent(saved.getId()));
        return toResponse(saved);
    }

    @Transactional
    public boolean start(Long jobId) {
        FormScoringRecalculationJob job = jobRepository.findByIdForUpdate(jobId).orElse(null);
        if (job == null || job.getStatus() != FormScoringRecalculationStatus.PENDING) return false;
        job.setStatus(FormScoringRecalculationStatus.RUNNING);
        job.setAttemptCount(job.getAttemptCount() + 1);
        job.setStartedAt(Instant.now());
        job.setCompletedAt(null);
        job.setErrorMessage(null);
        jobRepository.save(job);
        return true;
    }

    @Transactional
    public void complete(Long jobId) {
        FormScoringRecalculationJob job = jobRepository.findByIdForUpdate(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Scoring recalculation job not found"));
        if (job.getStatus() != FormScoringRecalculationStatus.RUNNING) return;

        FormVersion version = versionRepository.findByIdAndFormIdForUpdate(
                        job.getFormVersion().getForm().getId(), job.getFormVersion().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Form version not found"));
        FormScoringPolicy.Definition definition = scoringPolicy.resolve(version);
        int affected;
        if (job.getTargetMode() == PassingScoreMode.CUSTOM) {
            affected = submissionRepository.recalculateWithCustomFloor(version.getId(), job.getTargetPassingScore());
            version.setPassingScoreOverride(job.getTargetPassingScore());
        } else {
            BigDecimal legacyFloor = definition.configured()
                    ? definition.legacyRawPassingScore() : BigDecimal.ZERO;
            affected = submissionRepository.recalculateWithDefaultFloor(version.getId(), legacyFloor);
            version.setPassingScoreOverride(null);
        }
        versionRepository.save(version);
        job.setStatus(FormScoringRecalculationStatus.COMPLETED);
        job.setAffectedSubmissionCount((long) affected);
        job.setCompletedAt(Instant.now());
        job.setErrorMessage(null);
        jobRepository.save(job);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long jobId, String message) {
        FormScoringRecalculationJob job = jobRepository.findByIdForUpdate(jobId).orElse(null);
        if (job == null || job.getStatus() == FormScoringRecalculationStatus.COMPLETED) return;
        job.setStatus(FormScoringRecalculationStatus.FAILED);
        job.setCompletedAt(Instant.now());
        job.setErrorMessage(message == null || message.isBlank()
                ? "Không thể tính lại kết quả đánh giá" : message.substring(0, Math.min(message.length(), 2000)));
        jobRepository.save(job);
    }

    @Transactional
    public List<Long> recoverAndFindPending() {
        jobRepository.recoverStale(FormScoringRecalculationStatus.RUNNING,
                FormScoringRecalculationStatus.PENDING, Instant.now().minus(Duration.ofMinutes(5)));
        return jobRepository.findByStatusOrderByCreatedAtAsc(
                        FormScoringRecalculationStatus.PENDING, PageRequest.of(0, 20))
                .stream().map(FormScoringRecalculationJob::getId).toList();
    }

    @Transactional(readOnly = true)
    public Optional<FormScoringRecalculationJob> latest(Long versionId) {
        return jobRepository.findFirstByFormVersion_IdOrderByCreatedAtDesc(versionId);
    }

    public FormScoringRecalculationJobResponse toResponse(FormScoringRecalculationJob job) {
        return FormScoringRecalculationJobResponse.builder()
                .id(job.getId())
                .formId(job.getFormVersion().getForm().getId())
                .versionId(job.getFormVersion().getId())
                .status(job.getStatus())
                .targetMode(job.getTargetMode())
                .targetPassingScore(job.getTargetPassingScore())
                .previousMode(job.getPreviousMode())
                .previousPassingScore(job.getPreviousPassingScore())
                .affectedSubmissionCount(job.getAffectedSubmissionCount())
                .attemptCount(job.getAttemptCount())
                .requestedBy(job.getRequestedBy() == null ? null : job.getRequestedBy().getName())
                .startedAt(job.getStartedAt())
                .completedAt(job.getCompletedAt())
                .errorMessage(job.getErrorMessage())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    private FormScoringRecalculationJob find(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Scoring recalculation job not found"));
    }
}
