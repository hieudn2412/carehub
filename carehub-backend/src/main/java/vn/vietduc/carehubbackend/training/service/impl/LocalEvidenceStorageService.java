package vn.vietduc.carehubbackend.training.service.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;

import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
public class LocalEvidenceStorageService implements EvidenceStorageService {
    private final Path storageRoot;

    public LocalEvidenceStorageService(
            @Value("${app.training.evidence.storage-dir:target/local-evidence-storage}") String storageDir
    ) {
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
    }

    @Override
    public StoredEvidenceObject store(EvidenceObjectRequest request, InputStream content) throws IOException {
        Files.createDirectories(storageRoot);
        String extension = extensionOf(request.originalFilename());
        String objectKey = UUID.randomUUID() + (extension.isBlank() ? "" : "." + extension);
        Path target = storageRoot.resolve(objectKey).normalize();
        if (!target.startsWith(storageRoot)) {
            throw new IOException("Invalid evidence object key");
        }
        Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        return new StoredEvidenceObject(objectKey, request.checksumSha256(), request.fileSizeBytes());
    }

    @Override
    public String createDownloadUrl(String objectKey, Duration ttl) {
        long expiresAt = Instant.now().plus(ttl).getEpochSecond();
        String token = URLEncoder.encode(objectKey + ":" + expiresAt, StandardCharsets.UTF_8);
        return "/api/v1/training/evidence-download/" + token;
    }

    @Override
    public void delete(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        Path target = storageRoot.resolve(objectKey).normalize();
        if (!target.startsWith(storageRoot)) {
            return;
        }
        try {
            Files.deleteIfExists(target);
        } catch (IOException ignored) {
            // Metadata soft-delete must not fail just because a local temp file is already gone.
        }
    }

    public LocalEvidenceDownload loadByDownloadToken(String token) {
        String decodedToken = URLDecoder.decode(token, StandardCharsets.UTF_8);
        int separatorIndex = decodedToken.lastIndexOf(':');
        if (separatorIndex < 1 || separatorIndex == decodedToken.length() - 1) {
            throw new ResourceNotFoundException("Evidence download URL not found");
        }

        String objectKey = decodedToken.substring(0, separatorIndex);
        long expiresAt;
        try {
            expiresAt = Long.parseLong(decodedToken.substring(separatorIndex + 1));
        } catch (NumberFormatException ex) {
            throw new ResourceNotFoundException("Evidence download URL not found");
        }
        if (Instant.now().getEpochSecond() > expiresAt) {
            throw new ResourceNotFoundException("Evidence download URL expired");
        }

        Path target = storageRoot.resolve(objectKey).normalize();
        if (!target.startsWith(storageRoot) || !Files.isRegularFile(target)) {
            throw new ResourceNotFoundException("Evidence file not found");
        }
        return new LocalEvidenceDownload(objectKey, target, mediaTypeOf(objectKey));
    }

    private MediaType mediaTypeOf(String objectKey) {
        String extension = extensionOf(objectKey);
        return switch (extension) {
            case "jpg", "jpeg" -> MediaType.IMAGE_JPEG;
            case "png" -> MediaType.IMAGE_PNG;
            case "pdf" -> MediaType.APPLICATION_PDF;
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
    }

    private String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "";
        }
        return filename.substring(dotIndex + 1).toLowerCase();
    }

    public record LocalEvidenceDownload(
            String objectKey,
            Path path,
            MediaType mediaType
    ) {
    }
}
