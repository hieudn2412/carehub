package vn.vietduc.carehubbackend.training.service;

import java.time.Duration;

public interface EvidenceStorageService {
    StoredEvidenceObject store(EvidenceObjectRequest request, byte[] content);

    String createDownloadUrl(String objectKey, String originalFilename, Duration ttl);

    String createPreviewUrl(String objectKey, String originalFilename, Duration ttl);

    void delete(String objectKey);

    record EvidenceObjectRequest(
            Long trainingRecordId,
            String originalFilename,
            String mimeType,
            long fileSizeBytes,
            String storedChecksumSha256
    ) {
    }

    record StoredEvidenceObject(
            String objectKey,
            String checksumSha256,
            long fileSizeBytes
    ) {
    }
}
