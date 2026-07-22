package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;
import vn.vietduc.carehubbackend.training.service.event.TrainingEvidenceDeletedEvent;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class EvidenceObjectDeletionService {
    private static final int RETRY_BATCH_SIZE = 100;

    private final TrainingEvidenceFileRepository evidenceFileRepository;
    private final EvidenceStorageService storageService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void deleteAfterCommit(TrainingEvidenceDeletedEvent event) {
        deleteAndMark(event.evidenceId(), event.objectKey());
    }

    @Scheduled(fixedDelayString = "${app.training.evidence.delete-retry-ms:600000}")
    public void retryPendingDeletes() {
        List<TrainingEvidenceFile> pending = evidenceFileRepository
                .findByActiveFalseAndObjectKeyIsNotNullAndStorageDeletedAtIsNullOrderByDeletedAtAsc(
                        PageRequest.of(0, RETRY_BATCH_SIZE)
                );
        pending.forEach(evidence -> deleteAndMark(evidence.getId(), evidence.getObjectKey()));
    }

    private void deleteAndMark(Long evidenceId, String objectKey) {
        try {
            storageService.delete(objectKey);
            evidenceFileRepository.markStorageDeleted(evidenceId, LocalDateTime.now());
        } catch (RuntimeException ex) {
            log.warn("Could not delete evidence object {}; it will be retried", objectKey, ex);
        }
    }
}
