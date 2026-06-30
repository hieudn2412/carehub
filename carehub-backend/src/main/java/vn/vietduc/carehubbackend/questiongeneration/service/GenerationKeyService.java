package vn.vietduc.carehubbackend.questiongeneration.service;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

@Service
public class GenerationKeyService {

    public String candidateKey(
            String provider,
            String model,
            String promptVersion,
            int questionsPerChunk,
            String chunkTextHash,
            String targetLanguage,
            int candidateIndex
    ) {
        String raw = String.join("|",
                nullToEmpty(provider),
                nullToEmpty(model),
                nullToEmpty(promptVersion),
                String.valueOf(questionsPerChunk),
                nullToEmpty(chunkTextHash),
                nullToEmpty(targetLanguage),
                "Q" + candidateIndex
        );
        return sha256(raw).substring(0, 32);
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
