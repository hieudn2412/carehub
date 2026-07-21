package vn.vietduc.carehubbackend.form.scoring;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import vn.vietduc.carehubbackend.form.entity.Form;
import vn.vietduc.carehubbackend.form.entity.FormVersion;
import vn.vietduc.carehubbackend.form.entity.enums.FormVersionStatus;
import vn.vietduc.carehubbackend.form.repository.FormVersionRepository;
import vn.vietduc.carehubbackend.form.submission.repository.FormSubmissionRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FormScoringRecalculationJobServiceTest {
    @Mock
    private FormScoringRecalculationJobRepository jobRepository;
    @Mock
    private FormVersionRepository versionRepository;
    @Mock
    private FormSubmissionRepository submissionRepository;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private FormScoringRecalculationJobService service;

    @BeforeEach
    void setUp() {
        service = new FormScoringRecalculationJobService(
                jobRepository,
                versionRepository,
                submissionRepository,
                new FormScoringPolicy(),
                eventPublisher
        );
    }

    @Test
    void appliesCustomPassingScoreToRetiredVersionAfterRecalculationCompletes() {
        FormVersion version = retiredVersion(new BigDecimal("8.0"));
        FormScoringRecalculationJob job = runningJob(version, PassingScoreMode.CUSTOM, new BigDecimal("7.5"));
        when(jobRepository.findByIdForUpdate(21L)).thenReturn(Optional.of(job));
        when(versionRepository.findByIdAndFormIdForUpdate(10L, 11L)).thenReturn(Optional.of(version));
        when(submissionRepository.recalculateWithCustomFloor(11L, new BigDecimal("7.5"))).thenReturn(14);

        service.complete(21L);

        assertThat(version.getPassingScoreOverride()).isEqualByComparingTo("7.5");
        assertThat(job.getStatus()).isEqualTo(FormScoringRecalculationStatus.COMPLETED);
        assertThat(job.getAffectedSubmissionCount()).isEqualTo(14L);
        assertThat(job.getCompletedAt()).isNotNull();
        verify(versionRepository).save(version);
        verify(jobRepository).save(job);
    }

    @Test
    void resetsRetiredVersionToLegacyPassingScore() {
        FormVersion version = retiredVersion(new BigDecimal("9.0"));
        FormScoringRecalculationJob job = runningJob(version, PassingScoreMode.DEFAULT, null);
        when(jobRepository.findByIdForUpdate(21L)).thenReturn(Optional.of(job));
        when(versionRepository.findByIdAndFormIdForUpdate(10L, 11L)).thenReturn(Optional.of(version));
        when(submissionRepository.recalculateWithDefaultFloor(11L, BigDecimal.ZERO)).thenReturn(3);

        service.complete(21L);

        assertThat(version.getPassingScoreOverride()).isNull();
        assertThat(job.getStatus()).isEqualTo(FormScoringRecalculationStatus.COMPLETED);
        assertThat(job.getAffectedSubmissionCount()).isEqualTo(3L);
    }

    @Test
    void failedJobCanBeRetriedWithoutChangingTargetPolicy() {
        FormVersion version = retiredVersion(null);
        FormScoringRecalculationJob job = runningJob(version, PassingScoreMode.CUSTOM, new BigDecimal("6.5"));
        job.setStatus(FormScoringRecalculationStatus.FAILED);
        job.setErrorMessage("database timeout");
        when(jobRepository.findByIdForUpdate(21L)).thenReturn(Optional.of(job));
        when(jobRepository.existsByFormVersion_IdAndStatusIn(eq(11L), anyCollection())).thenReturn(false);
        when(jobRepository.save(job)).thenReturn(job);

        service.retry(21L);

        assertThat(job.getStatus()).isEqualTo(FormScoringRecalculationStatus.PENDING);
        assertThat(job.getTargetPassingScore()).isEqualByComparingTo("6.5");
        assertThat(job.getErrorMessage()).isNull();
        verify(eventPublisher).publishEvent(new FormScoringRecalculationRequestedEvent(21L));
    }

    private FormVersion retiredVersion(BigDecimal passingScoreOverride) {
        Form form = Form.builder().id(10L).code("FORM-10").title("Form 10").build();
        return FormVersion.builder()
                .id(11L)
                .form(form)
                .versionNumber(2)
                .status(FormVersionStatus.RETIRED)
                .title("Version 2")
                .settingsJson(new LinkedHashMap<>())
                .passingScoreOverride(passingScoreOverride)
                .sections(new ArrayList<>())
                .build();
    }

    private FormScoringRecalculationJob runningJob(
            FormVersion version,
            PassingScoreMode mode,
            BigDecimal passingScore
    ) {
        return FormScoringRecalculationJob.builder()
                .id(21L)
                .formVersion(version)
                .status(FormScoringRecalculationStatus.RUNNING)
                .targetMode(mode)
                .targetPassingScore(passingScore)
                .previousMode(version.getPassingScoreOverride() == null
                        ? PassingScoreMode.DEFAULT : PassingScoreMode.CUSTOM)
                .build();
    }
}
