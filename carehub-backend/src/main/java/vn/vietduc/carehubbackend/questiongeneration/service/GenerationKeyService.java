package vn.vietduc.carehubbackend.questiongeneration.service;

import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

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
        return candidateKey(provider, model, promptVersion, questionsPerChunk,
                chunkTextHash, targetLanguage, categoryId, null, candidateIndex);
    }

    /**
     * Builds an idempotency key for one generated candidate.
     *
     * <p>A category is part of the generation context: the same source text can
     * legitimately produce a different question when assigned to another
     * question category.</p>
     *
     * <p>The document is part of it too. Without {@code documentId} the key is derived purely
     * from chunk CONTENT, so two documents that share a paragraph — a standard safety preamble
     * or a common regulations section, which is the norm across a hospital SOP set — collide:
     * the first document generates questions, the second silently produces none for that chunk.</p>
     *
     * <p>Both optional parts keep their {@code null} form compatible so keys created before each
     * part was introduced still match.</p>
     */
    public String candidateKey(
            String provider,
            String model,
            String promptVersion,
            int questionsPerChunk,
            String chunkTextHash,
            String targetLanguage,
            Long categoryId,
            Long documentId,
            int candidateIndex
    ) {
        List<String> parts = new ArrayList<>(List.of(
                nullToEmpty(provider),
                nullToEmpty(model),
                nullToEmpty(promptVersion),
                String.valueOf(questionsPerChunk),
                nullToEmpty(chunkTextHash),
                nullToEmpty(targetLanguage)
        ));
        if (categoryId != null) {
            parts.add("CAT" + categoryId);
        }
        if (documentId != null) {
            parts.add("DOC" + documentId);
        }
        parts.add("Q" + candidateIndex);
        return sha256(String.join("|", parts)).substring(0, 32);
    }

    public String groundedCandidateKey(
            String provider,
            String model,
            String pipelineVersion,
            String promptHash,
            Long documentId,
            Long chunkId,
            String chunkTextHash,
            Long categoryId,
            int questionsPerChunk,
            String targetDifficulty,
            int candidateIndex,
            int attemptNumber
    ) {
        return sha256(String.join("|",
                nullToEmpty(provider),
                nullToEmpty(model),
                nullToEmpty(pipelineVersion),
                nullToEmpty(promptHash),
                "DOC" + documentId,
                "CHUNK" + chunkId,
                nullToEmpty(chunkTextHash),
                "CAT" + categoryId,
                "MAX" + questionsPerChunk,
                nullToEmpty(targetDifficulty),
                "Q" + candidateIndex,
                "ATTEMPT" + attemptNumber
        )).substring(0, 32);
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
