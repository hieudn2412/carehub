package vn.vietduc.carehubbackend.training.service;

import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;

public interface EvidenceStorageService {
    StoredEvidenceObject store(EvidenceObjectRequest request, InputStream content) throws IOException;

    String createDownloadUrl(String objectKey, Duration ttl);

    void delete(String objectKey);

    record EvidenceObjectRequest(
            String originalFilename,
            String mimeType,
            long fileSizeBytes,
            String checksumSha256
    ) {
    }

    record StoredEvidenceObject(
            String objectKey,
            String checksumSha256,
            long fileSizeBytes
    ) {
    }
}
