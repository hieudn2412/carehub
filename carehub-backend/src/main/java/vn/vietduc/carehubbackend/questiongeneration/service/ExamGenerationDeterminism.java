package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.questiongeneration.entity.ExamConfigSourceFilter;
import vn.vietduc.carehubbackend.questiongeneration.entity.QuestionBankQuestion;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.Collections;
import java.util.stream.Collectors;

public final class ExamGenerationDeterminism {
    public static final String ALGORITHM_VERSION = "DIRECT_BANK_V1";

    private ExamGenerationDeterminism() {
    }

    public static long deriveVariantSeed(long masterSeed, int variantIndex) {
        byte[] digest = sha256((ALGORITHM_VERSION + "|" + masterSeed + "|" + variantIndex)
                .getBytes(StandardCharsets.UTF_8));
        return ByteBuffer.wrap(digest, 0, Long.BYTES).getLong();
    }

    /**
     * Fisher–Yates owned by this algorithm version. Keeping the loop here avoids
     * coupling reproducibility to an implementation detail of a collection library.
     */
    static <T> void stableShuffle(List<T> values, Random random) {
        for (int index = values.size(); index > 1; index--) {
            Collections.swap(values, index - 1, random.nextInt(index));
        }
    }

    public static String poolChecksum(
            int configVersion,
            List<ExamConfigSourceFilter> filters,
            List<QuestionBankQuestion> questions
    ) {
        String filterPart = filters == null ? "" : filters.stream()
                .sorted(Comparator.comparing((ExamConfigSourceFilter filter) -> filter.getFilterType().name())
                        .thenComparing(ExamConfigSourceFilter::getReferenceId))
                .map(filter -> filter.getFilterType().name() + ":" + filter.getReferenceId())
                .collect(Collectors.joining(","));
        String questionPart = questions == null ? "" : questions.stream()
                .sorted(Comparator.comparing(QuestionBankQuestion::getId))
                .map(question -> question.getId() + ":" + familyId(question) + ":"
                        + (question.getUpdatedAt() == null ? "" : question.getUpdatedAt()))
                .collect(Collectors.joining(","));
        return hex(sha256((ALGORITHM_VERSION + "|" + configVersion + "|" + filterPart + "|" + questionPart)
                .getBytes(StandardCharsets.UTF_8)));
    }

    public static String requestHash(
            Long configId,
            int configVersion,
            String namePrefix,
            int variantCount,
            Long requestedMasterSeed,
            boolean zeroOverlap
    ) {
        String canonical = configId + "|" + configVersion + "|" + normalize(namePrefix) + "|"
                + variantCount + "|" + (requestedMasterSeed == null ? "AUTO" : requestedMasterSeed) + "|"
                + zeroOverlap;
        return hex(sha256(canonical.getBytes(StandardCharsets.UTF_8)));
    }

    public static long familyId(QuestionBankQuestion question) {
        if (question == null || question.getId() == null) {
            return Long.MIN_VALUE;
        }
        QuestionBankQuestion current = question;
        Set<Long> visited = new HashSet<>();
        while (current != null && current.getId() != null) {
            if (!visited.add(current.getId())) {
                return visited.stream().mapToLong(Long::longValue).min().orElse(question.getId());
            }
            if (current.getParentQuestion() == null || current.getParentQuestion().getId() == null) {
                return current.getId();
            }
            current = current.getParentQuestion();
        }
        return question.getId();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private static byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String hex(byte[] digest) {
        StringBuilder value = new StringBuilder(digest.length * 2);
        for (byte item : digest) {
            value.append(String.format("%02x", item));
        }
        return value.toString();
    }
}
