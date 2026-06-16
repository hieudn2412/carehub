package vn.vietduc.carehubbackend.training.service.impl;

import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.training.enums.EvidenceModerationStatus;
import vn.vietduc.carehubbackend.training.service.EvidenceModerationService;

import java.util.Map;
import java.util.Set;

@Service
public class LocalEvidenceModerationService implements EvidenceModerationService {
    private static final long MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "application/pdf"
    );

    @Override
    public EvidenceModerationResult moderate(EvidenceModerationRequest request) {
        if (request.fileSizeBytes() <= 0 || request.fileSizeBytes() > MAX_FILE_SIZE_BYTES) {
            return failed("file_size_out_of_range");
        }
        if (!ALLOWED_MIME_TYPES.contains(request.mimeType())) {
            return failed("unsupported_mime_type");
        }
        return new EvidenceModerationResult(
                EvidenceModerationStatus.PASSED,
                "local-mock",
                Map.of("mock", true, "checks", "metadata-only")
        );
    }

    private EvidenceModerationResult failed(String reason) {
        return new EvidenceModerationResult(
                EvidenceModerationStatus.FAILED,
                "local-mock",
                Map.of("mock", true, "reason", reason)
        );
    }
}
