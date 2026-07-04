package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class DocumentQuestionJobWorker {
    private final DocumentQuestionJobService jobService;

    @Async("documentQuestionJobExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void processCreatedJob(DocumentQuestionJobCreatedEvent event) {
        try {
            log.info("Start async document question job jobId={}", event.jobId());
            jobService.processJob(event.jobId());
            log.info("Finished async document question job jobId={}", event.jobId());
        } catch (Exception ex) {
            log.error("Async document question job failed jobId={} message={}", event.jobId(), ex.getMessage(), ex);
            jobService.failJob(event.jobId(), ex.getMessage());
        }
    }
}
