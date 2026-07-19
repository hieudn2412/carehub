package vn.vietduc.carehubbackend.questiongeneration.paraphrase;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelService;

@Component
@RequiredArgsConstructor
@Slf4j
public class ParaphraseJobWorker {
    private final ParaphraseService paraphraseService;
    private final ParaphraseModelService modelService;

    @Async("paraphraseJobExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void processCreatedJob(ParaphraseJobCreatedEvent event) {
        try {
            ParaphraseService.GenerationContext context = paraphraseService.startJob(event.jobId());
            if (context == null) {
                log.info("Skip paraphrase job jobId={} because it is no longer CREATED", event.jobId());
                return;
            }
            log.info("Start async paraphrase job jobId={}", event.jobId());
            paraphraseService.completeJob(
                    context.jobId(),
                    modelService.paraphrase(context.toModelInput())
            );
            log.info("Finished async paraphrase job jobId={}", event.jobId());
        } catch (Exception ex) {
            log.error("Async paraphrase job failed jobId={} message={}", event.jobId(), ex.getMessage(), ex);
            paraphraseService.failJob(event.jobId(), ex.getMessage());
        }
    }
}
