package vn.vietduc.carehubbackend.training.service;

import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;

import java.util.Map;

public interface EvidenceModerationService {
    EvidenceModerationResult moderate(EvidenceModerationRequest request);

    record EvidenceModerationRequest(
            String originalFilename,
            String mimeType,
            long fileSizeBytes,
            String checksumSha256
    ) {
    }

    record EvidenceModerationResult(
            EvidenceModerationStatus status,
            String provider,
            Map<String, Object> result
    ) {
    }
}
