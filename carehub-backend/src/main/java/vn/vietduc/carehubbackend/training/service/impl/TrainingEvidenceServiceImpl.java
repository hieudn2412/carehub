package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import vn.vietduc.carehubbackend.exception.ConflictException;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.exception.ValidationException;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceDownloadUrlResponse;
import vn.vietduc.carehubbackend.training.dto.response.EvidenceMetadataResponse;
import vn.vietduc.carehubbackend.training.entity.TrainingEvidenceFile;
import vn.vietduc.carehubbackend.training.entity.TrainingRecord;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordChangeType;
import vn.vietduc.carehubbackend.training.enums.TrainingRecordStatus;
import vn.vietduc.carehubbackend.training.mapper.TrainingEvidenceMapper;
import vn.vietduc.carehubbackend.training.repository.TrainingEvidenceFileRepository;
import vn.vietduc.carehubbackend.training.repository.TrainingRecordRepository;
import vn.vietduc.carehubbackend.training.service.EvidenceModerationService;
import vn.vietduc.carehubbackend.training.service.EvidenceOptimizationService;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingAuditService;
import vn.vietduc.carehubbackend.training.service.TrainingEvidenceService;
import vn.vietduc.carehubbackend.training.service.event.TrainingEvidenceDeletedEvent;
import vn.vietduc.carehubbackend.user.entity.User;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class TrainingEvidenceServiceImpl implements TrainingEvidenceService {
    private static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);
    private static final Set<String> PREVIEWABLE_MIME_TYPES = Set.of("image/jpeg", "image/png");

    private final TrainingRecordRepository recordRepository;
    private final TrainingEvidenceFileRepository evidenceFileRepository;
    private final TrainingEvidenceMapper mapper;
    private final TrainingAccessPolicy accessPolicy;
    private final TrainingAuditService auditService;
    private final EvidenceModerationService moderationService;
    private final EvidenceOptimizationService optimizationService;
    private final EvidenceStorageService storageService;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionTemplate transactionTemplate;

    @Override
    @Transactional(readOnly = true)
    public List<EvidenceMetadataResponse> list(Long recordId) {
        TrainingRecord record = findScopedRecord(recordId);
        return evidenceFileRepository.findByTrainingRecord_IdAndActiveTrue(record.getId())
                .stream()
                .map(mapper::toMetadataResponse)
                .toList();
    }

    @Override
    public EvidenceMetadataResponse upload(Long recordId, MultipartFile file) {
        EvidenceOptimizationService.OptimizedEvidence optimized = optimizationService.optimize(file);
        transactionTemplate.executeWithoutResult(status -> ensureUploadAllowed(recordId, optimized.originalChecksumSha256()));

        EvidenceModerationService.EvidenceModerationResult moderation = moderationService.moderate(
                new EvidenceModerationService.EvidenceModerationRequest(
                        optimized.originalFilename(),
                        optimized.mimeType(),
                        optimized.storedFileSizeBytes(),
                        optimized.storedChecksumSha256()
                )
        );
        if (moderation.status() == EvidenceModerationStatus.FAILED) {
            throw ValidationException.field("file", "Evidence moderation failed: " + reasonOf(moderation.result()));
        }
        if (moderation.status() != EvidenceModerationStatus.PASSED) {
            throw new ConflictException("Evidence moderation did not pass");
        }

        EvidenceStorageService.StoredEvidenceObject stored = storageService.store(
                new EvidenceStorageService.EvidenceObjectRequest(
                        recordId,
                        optimized.originalFilename(),
                        optimized.mimeType(),
                        optimized.storedFileSizeBytes(),
                        optimized.storedChecksumSha256()
                ),
                optimized.storedBytes()
        );

        try {
            return Objects.requireNonNull(transactionTemplate.execute(status ->
                    persistUpload(recordId, optimized, moderation, stored)
            ));
        } catch (RuntimeException ex) {
            compensateFailedUpload(stored.objectKey());
            throw ex;
        }
    }

    @Override
    @Transactional
    public void delete(Long recordId, Long evidenceId) {
        TrainingRecord record = findScopedRecord(recordId);
        requireEditable(record);
        TrainingEvidenceFile evidence = evidenceFileRepository.findByIdAndTrainingRecord_Id(evidenceId, record.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Evidence file not found"));
        if (!evidence.isActive()) {
            return;
        }
        User actor = accessPolicy.currentActor();
        Map<String, Object> before = evidenceSnapshot(evidence);
        evidence.setActive(false);
        evidence.setDeletedAt(LocalDateTime.now());
        evidenceFileRepository.save(evidence);
        tryAudit(record, TrainingRecordChangeType.EVIDENCE_DELETED, before, evidenceSnapshot(evidence), actor);
        if (evidence.getObjectKey() != null && !evidence.getObjectKey().isBlank()) {
            eventPublisher.publishEvent(new TrainingEvidenceDeletedEvent(evidence.getId(), evidence.getObjectKey()));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public EvidenceDownloadUrlResponse createDownloadUrl(Long recordId, Long evidenceId) {
        TrainingEvidenceFile evidence = findActiveEvidence(recordId, evidenceId);
        LocalDateTime expiresAt = LocalDateTime.now().plus(DOWNLOAD_TTL);
        return new EvidenceDownloadUrlResponse(
                storageService.createDownloadUrl(
                        evidence.getObjectKey(),
                        evidence.getOriginalFilename(),
                        DOWNLOAD_TTL
                ),
                expiresAt
        );
    }

    @Override
    @Transactional(readOnly = true)
    public EvidenceDownloadUrlResponse createPreviewUrl(Long recordId, Long evidenceId) {
        TrainingEvidenceFile evidence = findActiveEvidence(recordId, evidenceId);
        if (!PREVIEWABLE_MIME_TYPES.contains(evidence.getMimeType())) {
            throw ValidationException.field("evidenceId", "Only JPEG and PNG evidence can be previewed");
        }
        LocalDateTime expiresAt = LocalDateTime.now().plus(DOWNLOAD_TTL);
        return new EvidenceDownloadUrlResponse(
                storageService.createPreviewUrl(
                        evidence.getObjectKey(),
                        evidence.getOriginalFilename(),
                        DOWNLOAD_TTL
                ),
                expiresAt
        );
    }

    private TrainingEvidenceFile findActiveEvidence(Long recordId, Long evidenceId) {
        TrainingRecord record = findScopedRecord(recordId);
        TrainingEvidenceFile evidence = evidenceFileRepository.findByIdAndTrainingRecord_Id(evidenceId, record.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Evidence file not found"));
        if (!evidence.isActive() || evidence.getObjectKey() == null || evidence.getObjectKey().isBlank()) {
            throw new ResourceNotFoundException("Evidence file not found");
        }
        return evidence;
    }

    private void ensureUploadAllowed(Long recordId, String originalChecksumSha256) {
        TrainingRecord record = findScopedRecord(recordId);
        requireEditable(record);
        if (evidenceFileRepository.existsByTrainingRecord_IdAndActiveTrueAndChecksumSha256(
                record.getId(),
                originalChecksumSha256
        )) {
            throw new ConflictException("Duplicate evidence file");
        }
    }

    private EvidenceMetadataResponse persistUpload(
            Long recordId,
            EvidenceOptimizationService.OptimizedEvidence optimized,
            EvidenceModerationService.EvidenceModerationResult moderation,
            EvidenceStorageService.StoredEvidenceObject stored
    ) {
        TrainingRecord record = findScopedRecord(recordId);
        requireEditable(record);
        if (evidenceFileRepository.existsByTrainingRecord_IdAndActiveTrueAndChecksumSha256(
                record.getId(),
                optimized.originalChecksumSha256()
        )) {
            throw new ConflictException("Duplicate evidence file");
        }
        User actor = accessPolicy.currentActor();
        TrainingEvidenceFile evidence = TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename(optimized.originalFilename())
                .objectKey(stored.objectKey())
                .mimeType(optimized.mimeType())
                .fileSizeBytes(stored.fileSizeBytes())
                .originalFileSizeBytes(optimized.originalFileSizeBytes())
                .checksumSha256(optimized.originalChecksumSha256())
                .storedChecksumSha256(stored.checksumSha256())
                .optimized(optimized.optimized())
                .moderationStatus(moderation.status())
                .moderationProvider(moderation.provider())
                .moderationResult(moderation.result())
                .moderationCheckedAt(LocalDateTime.now())
                .uploadedByUser(actor)
                .uploadedAt(LocalDateTime.now())
                .active(true)
                .build();
        TrainingEvidenceFile saved = evidenceFileRepository.save(evidence);
        tryAudit(record, TrainingRecordChangeType.EVIDENCE_UPLOADED, null, evidenceSnapshot(saved), actor);
        return mapper.toMetadataResponse(saved);
    }

    private void tryAudit(
            TrainingRecord record,
            TrainingRecordChangeType changeType,
            Map<String, Object> before,
            Map<String, Object> after,
            User actor
    ) {
        try {
            auditService.logRecordChange(record, changeType, before, after, actor);
        } catch (RuntimeException ex) {
            log.warn("Could not write {} audit log for training record {}", changeType, record.getId(), ex);
        }
    }

    private void compensateFailedUpload(String objectKey) {
        try {
            storageService.delete(objectKey);
        } catch (RuntimeException cleanupError) {
            log.error("Could not delete orphaned evidence object {} after database failure", objectKey, cleanupError);
        }
    }

    private TrainingRecord findScopedRecord(Long id) {
        TrainingRecord record = recordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training record not found"));
        accessPolicy.requireCanReadRecord(accessPolicy.currentActor(), accessPolicy.currentRoleCodes(), record);
        return record;
    }

    private void requireEditable(TrainingRecord record) {
        if (record.getWorkflowStatus() != TrainingRecordStatus.DRAFT) {
            throw new ConflictException("Training record evidence is not editable in status " + record.getWorkflowStatus());
        }
    }

    private String reasonOf(Map<String, Object> result) {
        if (result == null || result.get("reason") == null) {
            return "rejected";
        }
        return String.valueOf(result.get("reason"));
    }

    private Map<String, Object> evidenceSnapshot(TrainingEvidenceFile evidence) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", evidence.getId());
        data.put("trainingRecordId", evidence.getTrainingRecord() == null ? null : evidence.getTrainingRecord().getId());
        data.put("originalFilename", evidence.getOriginalFilename());
        data.put("mimeType", evidence.getMimeType());
        data.put("fileSizeBytes", evidence.getFileSizeBytes());
        data.put("originalFileSizeBytes", evidence.getOriginalFileSizeBytes());
        data.put("checksumSha256", evidence.getChecksumSha256());
        data.put("storedChecksumSha256", evidence.getStoredChecksumSha256());
        data.put("optimized", evidence.isOptimized());
        data.put("moderationStatus", evidence.getModerationStatus());
        data.put("active", evidence.isActive());
        return data;
    }
}
