package vn.vietduc.carehubbackend.training.service.impl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.exception.ResourceNotFoundException;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
public class LocalEvidenceStorageService implements EvidenceStorageService {
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final Path storageRoot;
    private final byte[] signingKey;

    public LocalEvidenceStorageService(
            @Value("${app.training.evidence.storage-dir:target/local-evidence-storage}") String storageDir,
            @Value("${app.jwt.secret}") String jwtSecret
    ) {
        this.storageRoot = Path.of(storageDir).toAbsolutePath().normalize();
        this.signingKey = jwtSecret.getBytes(StandardCharsets.UTF_8);
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
        String payload = objectKey + ":" + expiresAt;
        String signature = hmacSign(payload);
        String token = URLEncoder.encode(payload + ":" + signature, StandardCharsets.UTF_8);
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

        // Token format: objectKey:expiresAt:signature
        int sigSeparator = decodedToken.lastIndexOf(':');
        if (sigSeparator < 1 || sigSeparator == decodedToken.length() - 1) {
            throw new ResourceNotFoundException("Evidence download URL not found");
        }
        String payload = decodedToken.substring(0, sigSeparator);
        String expectedSignature = decodedToken.substring(sigSeparator + 1);

        // Verify HMAC signature
        if (!hmacSign(payload).equals(expectedSignature)) {
            throw new ResourceNotFoundException("Evidence download URL not found");
        }

        // Parse payload: objectKey:expiresAt
        int payloadSeparator = payload.lastIndexOf(':');
        if (payloadSeparator < 1 || payloadSeparator == payload.length() - 1) {
            throw new ResourceNotFoundException("Evidence download URL not found");
        }
        String objectKey = payload.substring(0, payloadSeparator);
        long expiresAt;
        try {
            expiresAt = Long.parseLong(payload.substring(payloadSeparator + 1));
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

    private String hmacSign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingKey, HMAC_ALGORITHM));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HMAC signing failed", ex);
        }
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
