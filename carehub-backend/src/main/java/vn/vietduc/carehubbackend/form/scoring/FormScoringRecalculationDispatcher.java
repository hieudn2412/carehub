package vn.vietduc.carehubbackend.form.scoring;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class FormScoringRecalculationDispatcher {
    private final FormScoringRecalculationJobService jobService;
    private final FormScoringRecalculationWorker worker;

    @Scheduled(fixedDelayString = "${app.form-scoring.recalculation-scan-ms:30000}")
    public void dispatchPendingJobs() {
        jobService.recoverAndFindPending().forEach(worker::processPending);
    }
}
