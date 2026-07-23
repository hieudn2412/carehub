package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Selects meaning-preserving candidates that are materially different from the
 * source. VietQuill beam search is deterministic and its highest-probability
 * beams are often near-copies, so beam order alone is not a useful quality
 * ranking.
 */
final class VietQuillCandidateSelector {
    private static final Set<String> CONTENT_STOP_WORDS = Set.of(
            "ai", "ay", "bi", "cac", "can", "co", "cua", "da", "dang", "de",
            "do", "duoc", "gi", "hay", "khi", "la", "lam", "mot", "nao",
            "nhung", "o", "sau", "se", "the", "thi", "theo", "truoc", "va", "voi"
    );

    List<String> select(String source, List<String> decoded, String changeStrength, int limit) {
        if (limit <= 0 || decoded == null || decoded.isEmpty()) {
            return List.of();
        }

        List<String> sourceTokens = tokens(source);
        Set<String> sourceContent = contentTokens(sourceTokens);
        DiversityTarget target = DiversityTarget.forStrength(changeStrength);
        Set<String> exactSeen = new LinkedHashSet<>();
        List<ScoredCandidate> eligible = new ArrayList<>();

        for (String value : decoded) {
            String cleaned = safe(value);
            String exactKey = normalizeText(cleaned).replace(" ", "");
            if (exactKey.isBlank() || !exactSeen.add(exactKey)) {
                continue;
            }

            List<String> candidateTokens = tokens(cleaned);
            double change = changeRatio(sourceTokens, candidateTokens);
            double coverage = contentCoverage(sourceContent, candidateTokens);
            if (change < target.minimumChange() || coverage < target.minimumCoverage()) {
                continue;
            }

            double score = Math.abs(change - target.preferredChange())
                    + Math.max(0, 0.80 - coverage) * 0.35;
            eligible.add(new ScoredCandidate(cleaned, candidateTokens, score));
        }

        eligible.sort(Comparator
                .comparingDouble(ScoredCandidate::score)
                .thenComparing(ScoredCandidate::text));

        List<ScoredCandidate> selected = new ArrayList<>();
        for (ScoredCandidate candidate : eligible) {
            boolean nearDuplicate = selected.stream()
                    .anyMatch(previous -> isNearDuplicate(previous.tokens(), candidate.tokens()));
            if (!nearDuplicate) {
                selected.add(candidate);
            }
            if (selected.size() == limit) {
                break;
            }
        }
        return selected.stream().map(ScoredCandidate::text).toList();
    }

    double changeRatio(String source, String candidate) {
        return changeRatio(tokens(source), tokens(candidate));
    }

    private double changeRatio(List<String> source, List<String> candidate) {
        if (source.isEmpty() || candidate.isEmpty()) {
            return source.equals(candidate) ? 0 : 1;
        }
        double lexicalChange = 1 - jaccardSimilarity(source, candidate);
        double sequenceChange = 1 - sequenceSimilarity(source, candidate);
        return Math.max(lexicalChange, sequenceChange);
    }

    private boolean isNearDuplicate(List<String> left, List<String> right) {
        return jaccardSimilarity(left, right) >= 0.88
                && sequenceSimilarity(left, right) >= 0.82;
    }

    private double contentCoverage(Set<String> sourceContent, List<String> candidateTokens) {
        if (sourceContent.isEmpty()) {
            return 1;
        }
        Set<String> candidateContent = contentTokens(candidateTokens);
        long retained = sourceContent.stream().filter(candidateContent::contains).count();
        return (double) retained / sourceContent.size();
    }

    private Set<String> contentTokens(List<String> values) {
        Set<String> result = new LinkedHashSet<>(values);
        result.removeAll(CONTENT_STOP_WORDS);
        return result;
    }

    private double jaccardSimilarity(List<String> left, List<String> right) {
        Set<String> leftSet = new LinkedHashSet<>(left);
        Set<String> rightSet = new LinkedHashSet<>(right);
        Set<String> intersection = new LinkedHashSet<>(leftSet);
        intersection.retainAll(rightSet);
        Set<String> union = new LinkedHashSet<>(leftSet);
        union.addAll(rightSet);
        return union.isEmpty() ? 1 : (double) intersection.size() / union.size();
    }

    private double sequenceSimilarity(List<String> left, List<String> right) {
        int[][] lengths = new int[left.size() + 1][right.size() + 1];
        for (int leftIndex = 1; leftIndex <= left.size(); leftIndex++) {
            for (int rightIndex = 1; rightIndex <= right.size(); rightIndex++) {
                if (left.get(leftIndex - 1).equals(right.get(rightIndex - 1))) {
                    lengths[leftIndex][rightIndex] = lengths[leftIndex - 1][rightIndex - 1] + 1;
                } else {
                    lengths[leftIndex][rightIndex] = Math.max(
                            lengths[leftIndex - 1][rightIndex],
                            lengths[leftIndex][rightIndex - 1]
                    );
                }
            }
        }
        return (double) lengths[left.size()][right.size()] / Math.max(left.size(), right.size());
    }

    private List<String> tokens(String value) {
        String normalized = normalizeText(value)
                .replace("nguoi benh", "benhnhan")
                .replace("benh nhan", "benhnhan");
        if (normalized.isBlank()) {
            return List.of();
        }
        return Arrays.stream(normalized.split("[^\\p{L}\\p{N}]+"))
                .filter(token -> !token.isBlank())
                .toList();
    }

    private String normalizeText(String value) {
        String decomposed = Normalizer.normalize(safe(value), Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "")
                .replace('đ', 'd')
                .replace('Đ', 'D')
                .toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private record ScoredCandidate(String text, List<String> tokens, double score) {
    }

    private record DiversityTarget(double minimumChange, double preferredChange, double minimumCoverage) {
        private static DiversityTarget forStrength(String value) {
            return switch (value == null ? "" : value.trim().toLowerCase(Locale.ROOT)) {
                case "low", "nhẹ" -> new DiversityTarget(0.08, 0.18, 0.65);
                case "high", "mạnh" -> new DiversityTarget(0.22, 0.42, 0.60);
                default -> new DiversityTarget(0.22, 0.32, 0.58);
            };
        }
    }
}
