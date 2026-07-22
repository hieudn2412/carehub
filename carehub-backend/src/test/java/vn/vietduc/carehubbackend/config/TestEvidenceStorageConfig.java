package vn.vietduc.carehubbackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import vn.vietduc.carehubbackend.training.service.EvidenceStorageService;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
@Profile("test")
public class TestEvidenceStorageConfig {
    @Bean
    EvidenceStorageService evidenceStorageService() {
        return new InMemoryEvidenceStorageService();
    }

    static class InMemoryEvidenceStorageService implements EvidenceStorageService {
        private final Map<String, byte[]> objects = new ConcurrentHashMap<>();

        @Override
        public StoredEvidenceObject store(EvidenceObjectRequest request, byte[] content) {
            String extension = extensionOf(request.originalFilename());
            String key = "training-records/" + request.trainingRecordId()
                    + "/evidences/" + UUID.randomUUID()
                    + (extension.isBlank() ? "" : "." + extension);
            objects.put(key, content.clone());
            return new StoredEvidenceObject(key, request.storedChecksumSha256(), content.length);
        }

        @Override
        public String createDownloadUrl(String objectKey, String originalFilename, Duration ttl) {
            return "https://evidence.test/" + URLEncoder.encode(objectKey, StandardCharsets.UTF_8)
                    + "?filename=" + URLEncoder.encode(originalFilename, StandardCharsets.UTF_8)
                    + "&ttl=" + ttl.toSeconds();
        }

        @Override
        public String createPreviewUrl(String objectKey, String originalFilename, Duration ttl) {
            return "https://evidence.test/" + URLEncoder.encode(objectKey, StandardCharsets.UTF_8)
                    + "?preview=true&filename=" + URLEncoder.encode(originalFilename, StandardCharsets.UTF_8)
                    + "&ttl=" + ttl.toSeconds();
        }

        @Override
        public void delete(String objectKey) {
            objects.remove(objectKey);
        }

        private String extensionOf(String filename) {
            int dot = filename == null ? -1 : filename.lastIndexOf('.');
            return dot < 0 || dot == filename.length() - 1 ? "" : filename.substring(dot + 1).toLowerCase();
        }
    }
}
