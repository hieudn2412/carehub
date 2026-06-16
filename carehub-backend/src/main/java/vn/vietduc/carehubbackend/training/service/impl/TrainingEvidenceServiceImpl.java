package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;
import vn.vietduc.carehubbackend.training.service.TrainingAccessPolicy;
import vn.vietduc.carehubbackend.training.service.TrainingAuditService;
import vn.vietduc.carehubbackend.training.service.TrainingEvidenceService;
import vn.vietduc.carehubbackend.user.entity.User;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TrainingEvidenceServiceImpl implements TrainingEvidenceService {
    private static final long MAX_FILE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("jpg", "jpeg", "png", "pdf");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of("image/jpeg", "image/png", "application/pdf");
    private static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);

    private final TrainingRecordRepository recordRepository;
    private final TrainingEvidenceFileRepository evidenceFileRepository;
    private final TrainingEvidenceMapper mapper;
    private final TrainingAccessPolicy accessPolicy;
    private final TrainingAuditService auditService;
    private final EvidenceModerationService moderationService;
    private final EvidenceStorageService storageService;

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
    @Transactional
    public EvidenceMetadataResponse upload(Long recordId, MultipartFile file) {
        TrainingRecord record = findScopedRecord(recordId);
        requireEditable(record);
        User actor = accessPolicy.currentActor();
        FileInspection inspection = inspect(file);

        if (evidenceFileRepository.existsByTrainingRecord_IdAndActiveTrueAndChecksumSha256(
                record.getId(),
                inspection.checksumSha256()
        )) {
            throw new ConflictException("Duplicate evidence file");
        }

        EvidenceModerationService.EvidenceModerationResult moderation = moderationService.moderate(
                new EvidenceModerationService.EvidenceModerationRequest(
                        inspection.sanitizedFilename(),
                        inspection.mimeType(),
                        inspection.bytes().length,
                        inspection.checksumSha256()
                )
        );
        if (moderation.status() == EvidenceModerationStatus.FAILED) {
            throw ValidationException.field("file", "Evidence moderation failed: " + reasonOf(moderation.result()));
        }
        if (moderation.status() != EvidenceModerationStatus.PASSED) {
            throw new ConflictException("Evidence moderation did not pass");
        }

        EvidenceStorageService.StoredEvidenceObject stored;
        try {
            stored = storageService.store(
                    new EvidenceStorageService.EvidenceObjectRequest(
                            inspection.sanitizedFilename(),
                            inspection.mimeType(),
                            inspection.bytes().length,
                            inspection.checksumSha256()
                    ),
                    new ByteArrayInputStream(inspection.bytes())
            );
        } catch (IOException ex) {
            throw new ConflictException("Could not store evidence file");
        }

        TrainingEvidenceFile evidence = TrainingEvidenceFile.builder()
                .trainingRecord(record)
                .originalFilename(inspection.sanitizedFilename())
                .objectKey(stored.objectKey())
                .mimeType(inspection.mimeType())
                .fileSizeBytes(stored.fileSizeBytes())
                .checksumSha256(stored.checksumSha256())
                .moderationStatus(moderation.status())
                .moderationProvider(moderation.provider())
                .moderationResult(moderation.result())
                .moderationCheckedAt(LocalDateTime.now())
                .uploadedByUser(actor)
                .uploadedAt(LocalDateTime.now())
                .active(true)
                .build();
        TrainingEvidenceFile saved = evidenceFileRepository.save(evidence);
        auditService.logRecordChange(record, TrainingRecordChangeType.EVIDENCE_UPLOADED, null, evidenceSnapshot(saved), actor);
        return mapper.toMetadataResponse(saved);
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
        auditService.logRecordChange(record, TrainingRecordChangeType.EVIDENCE_DELETED, before, evidenceSnapshot(evidence), actor);
    }

    @Override
    @Transactional(readOnly = true)
    public EvidenceDownloadUrlResponse createDownloadUrl(Long recordId, Long evidenceId) {
        TrainingRecord record = findScopedRecord(recordId);
        TrainingEvidenceFile evidence = evidenceFileRepository.findByIdAndTrainingRecord_Id(evidenceId, record.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Evidence file not found"));
        if (!evidence.isActive() || evidence.getObjectKey() == null || evidence.getObjectKey().isBlank()) {
            throw new ResourceNotFoundException("Evidence file not found");
        }
        LocalDateTime expiresAt = LocalDateTime.now().plus(DOWNLOAD_TTL);
        return new EvidenceDownloadUrlResponse(
                storageService.createDownloadUrl(evidence.getObjectKey(), DOWNLOAD_TTL),
                expiresAt
        );
    }

    private TrainingRecord findScopedRecord(Long id) {
        TrainingRecord record = recordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training record not found"));
        accessPolicy.requireCanReadRecord(accessPolicy.currentActor(), accessPolicy.currentRoleCodes(), record);
        return record;
    }

    private void requireEditable(TrainingRecord record) {
        if (record.getWorkflowStatus() != TrainingRecordStatus.DRAFT
                && record.getWorkflowStatus() != TrainingRecordStatus.REJECTED) {
            throw new ConflictException("Training record evidence is not editable in status " + record.getWorkflowStatus());
        }
    }

    private FileInspection inspect(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ValidationException.field("file", "Evidence file must not be empty");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw ValidationException.field("file", "Could not read evidence file");
        }
        if (bytes.length <= 0 || bytes.length > MAX_FILE_SIZE_BYTES) {
            throw ValidationException.field("file", "Evidence file size must be greater than 0 and not exceed 5 MB");
        }

        String sanitizedFilename = sanitizeFilename(file.getOriginalFilename());
        String extension = extensionOf(sanitizedFilename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw ValidationException.field("file", "Evidence file extension must be JPG, PNG, or PDF");
        }

        String detectedMimeType = detectMimeType(bytes);
        String declaredMimeType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!ALLOWED_MIME_TYPES.contains(detectedMimeType) || !detectedMimeType.equals(declaredMimeType)) {
            throw ValidationException.field("file", "Evidence file content does not match an allowed JPG, PNG, or PDF");
        }
        if (!extensionMatchesMime(extension, detectedMimeType)) {
            throw ValidationException.field("file", "Evidence file extension does not match file content");
        }

        return new FileInspection(sanitizedFilename, detectedMimeType, bytes, sha256(bytes));
    }

    private String sanitizeFilename(String filename) {
        String value = filename == null || filename.isBlank() ? "evidence" : filename;
        value = value.replace('\\', '/');
        int slashIndex = value.lastIndexOf('/');
        if (slashIndex >= 0) {
            value = value.substring(slashIndex + 1);
        }
        value = value.replaceAll("[^A-Za-z0-9._-]", "_");
        if (value.length() > 160) {
            String extension = extensionOf(value);
            int keep = extension.isBlank() ? 160 : 159 - extension.length();
            value = value.substring(0, keep) + (extension.isBlank() ? "" : "." + extension);
        }
        return value.isBlank() ? "evidence" : value;
    }

    private String extensionOf(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "";
        }
        return filename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }

    private String detectMimeType(byte[] bytes) {
        if (bytes.length >= 3
                && (bytes[0] & 0xFF) == 0xFF
                && (bytes[1] & 0xFF) == 0xD8
                && (bytes[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
                && (bytes[0] & 0xFF) == 0x89
                && bytes[1] == 0x50
                && bytes[2] == 0x4E
                && bytes[3] == 0x47
                && bytes[4] == 0x0D
                && bytes[5] == 0x0A
                && bytes[6] == 0x1A
                && bytes[7] == 0x0A) {
            return "image/png";
        }
        if (bytes.length >= 4 && bytes[0] == 0x25 && bytes[1] == 0x50 && bytes[2] == 0x44 && bytes[3] == 0x46) {
            return "application/pdf";
        }
        return "application/octet-stream";
    }

    private boolean extensionMatchesMime(String extension, String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> extension.equals("jpg") || extension.equals("jpeg");
            case "image/png" -> extension.equals("png");
            case "application/pdf" -> extension.equals("pdf");
            default -> false;
        };
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
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
        data.put("checksumSha256", evidence.getChecksumSha256());
        data.put("moderationStatus", evidence.getModerationStatus());
        data.put("active", evidence.isActive());
        return data;
    }

    private record FileInspection(
            String sanitizedFilename,
            String mimeType,
            byte[] bytes,
            String checksumSha256
    ) {
    }
}
