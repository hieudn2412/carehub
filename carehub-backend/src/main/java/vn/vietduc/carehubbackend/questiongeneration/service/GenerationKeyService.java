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
        return candidateKey(
                provider,
                model,
                promptVersion,
                questionsPerChunk,
                chunkTextHash,
                targetLanguage,
                null,
                candidateIndex
        );
    }

    /**
     * Builds an idempotency key for one generated candidate.
     *
     * A category is part of the generation context: the same source text can
     * legitimately produce a different question when assigned to another
     * question category. Keeping the null form compatible preserves the keys
     * created before category-aware generation was introduced.
     */
    public String candidateKey(
            String provider,
            String model,
            String promptVersion,
            int questionsPerChunk,
            String chunkTextHash,
            String targetLanguage,
            Long categoryId,
            int candidateIndex
    ) {
        String raw = categoryId == null
                ? String.join("|",
                nullToEmpty(provider),
                nullToEmpty(model),
                nullToEmpty(promptVersion),
                String.valueOf(questionsPerChunk),
                nullToEmpty(chunkTextHash),
                nullToEmpty(targetLanguage),
                "Q" + candidateIndex
        )
                : String.join("|",
                nullToEmpty(provider),
                nullToEmpty(model),
                nullToEmpty(promptVersion),
                String.valueOf(questionsPerChunk),
                nullToEmpty(chunkTextHash),
                nullToEmpty(targetLanguage),
                "CAT" + categoryId,
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
