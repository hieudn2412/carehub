package vn.vietduc.carehubbackend.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.exception.ServiceUnavailableException;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.service.event.TrainingEvidenceDeletedEvent;
import vn.vietduc.carehubbackend.training.service.impl.EvidenceObjectDeletionService;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class EvidenceObjectDeletionServiceTest {
    private TrainingEvidenceFileRepository repository;
    private EvidenceStorageService storageService;
    private EvidenceObjectDeletionService service;

    @BeforeEach
    void setUp() {
        repository = mock(TrainingEvidenceFileRepository.class);
        storageService = mock(EvidenceStorageService.class);
        service = new EvidenceObjectDeletionService(repository, storageService);
    }

    @Test
    void marksObjectDeletedAfterSuccessfulR2Delete() {
        service.deleteAfterCommit(new TrainingEvidenceDeletedEvent(7L, "key.jpg"));

        verify(storageService).delete("key.jpg");
        verify(repository).markStorageDeleted(eq(7L), any(LocalDateTime.class));
    }

    @Test
    void leavesObjectPendingWhenR2DeleteFails() {
        doThrow(new ServiceUnavailableException("R2 unavailable"))
                .when(storageService)
                .delete("key.jpg");

        service.deleteAfterCommit(new TrainingEvidenceDeletedEvent(7L, "key.jpg"));

        verify(repository, never()).markStorageDeleted(eq(7L), any(LocalDateTime.class));
    }
}
