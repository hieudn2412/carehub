package vn.vietduc.carehubbackend.form.scoring;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class FormScoringRecalculationWorker {
    private final FormScoringRecalculationJobService jobService;

    @Async("formScoringRecalculationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onRequested(FormScoringRecalculationRequestedEvent event) {
        process(event.jobId());
    }

    @Async("formScoringRecalculationExecutor")
    public void processPending(Long jobId) {
        process(jobId);
    }

    private void process(Long jobId) {
        try {
            if (!jobService.start(jobId)) return;
            jobService.complete(jobId);
        } catch (Exception ex) {
            log.error("Scoring recalculation failed jobId={} message={}", jobId, ex.getMessage(), ex);
            jobService.fail(jobId, ex.getMessage());
        }
    }
}
