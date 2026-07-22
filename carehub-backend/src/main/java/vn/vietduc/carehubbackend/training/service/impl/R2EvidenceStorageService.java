package vn.vietduc.carehubbackend.training.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.config.R2Properties;
import vn.vietduc.carehubbackend.exception.ServiceUnavailableException;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
@Profile("!test")
@RequiredArgsConstructor
public class R2EvidenceStorageService implements EvidenceStorageService {
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final R2Properties properties;

    @Override
    public StoredEvidenceObject store(EvidenceObjectRequest request, byte[] content) {
        String objectKey = objectKey(request);
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .contentType(request.mimeType())
                .contentLength(request.fileSizeBytes())
                .metadata(Map.of(
                        "training-record-id", request.trainingRecordId().toString(),
                        "sha256", request.storedChecksumSha256()
                ))
                .build();
        try {
            s3Client.putObject(putRequest, RequestBody.fromBytes(content));
            return new StoredEvidenceObject(
                    objectKey,
                    request.storedChecksumSha256(),
                    request.fileSizeBytes()
            );
        } catch (SdkException ex) {
            throw new ServiceUnavailableException("Could not store evidence file", ex);
        }
    }

    @Override
    public String createDownloadUrl(String objectKey, String originalFilename, Duration ttl) {
        return createAccessUrl(objectKey, originalFilename, ttl, "attachment");
    }

    @Override
    public String createPreviewUrl(String objectKey, String originalFilename, Duration ttl) {
        return createAccessUrl(objectKey, originalFilename, ttl, "inline");
    }

    private String createAccessUrl(
            String objectKey,
            String originalFilename,
            Duration ttl,
            String dispositionType
    ) {
        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .responseContentDisposition(contentDisposition(dispositionType, originalFilename))
                .build();
        try {
            return s3Presigner.presignGetObject(GetObjectPresignRequest.builder()
                            .signatureDuration(ttl)
                            .getObjectRequest(getRequest)
                            .build())
                    .url()
                    .toExternalForm();
        } catch (SdkException ex) {
            throw new ServiceUnavailableException("Could not create evidence access URL", ex);
        }
    }

    private String contentDisposition(String dispositionType, String originalFilename) {
        String safeFilename = originalFilename == null || originalFilename.isBlank()
                ? "evidence"
                : originalFilename.replaceAll("[\\r\\n\\\"\\\\]", "_");
        return dispositionType + "; filename=\"" + safeFilename + "\"";
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(properties.bucket())
                    .key(objectKey)
                    .build());
        } catch (SdkException ex) {
            throw new ServiceUnavailableException("Could not delete evidence file", ex);
        }
    }

    private String objectKey(EvidenceObjectRequest request) {
        String extension = extensionOf(request.originalFilename());
        return "training-records/" + request.trainingRecordId()
                + "/evidences/" + UUID.randomUUID()
                + (extension.isBlank() ? "" : "." + extension);
    }

    private String extensionOf(String filename) {
        int dot = filename == null ? -1 : filename.lastIndexOf('.');
        return dot < 0 || dot == filename.length() - 1 ? "" : filename.substring(dot + 1).toLowerCase();
    }
}
