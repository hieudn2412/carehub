package vn.vietduc.carehubbackend.questiongeneration.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/** Deterministic largest-remainder allocation used at both blueprint levels. */
public final class ExamBlueprintAllocator {
    private ExamBlueprintAllocator() {
    }

    public static List<Integer> allocate(List<BigDecimal> percentages, List<Integer> supplied, int total) {
        if (supplied != null && supplied.stream().allMatch(Objects::nonNull)) {
            return List.copyOf(supplied);
        }
        if (percentages == null || percentages.isEmpty()) {
            return List.of();
        }
        List<BigDecimal> raw = percentages.stream()
                .map(value -> value.multiply(BigDecimal.valueOf(total))
                        .divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP))
                .toList();
        List<Integer> counts = raw.stream()
                .map(BigDecimal::intValue)
                .collect(Collectors.toCollection(ArrayList::new));
        int remaining = total - counts.stream().mapToInt(Integer::intValue).sum();
        while (remaining-- > 0) {
            int best = 0;
            for (int index = 1; index < raw.size(); index++) {
                BigDecimal candidateRemainder = raw.get(index).subtract(BigDecimal.valueOf(counts.get(index)));
                BigDecimal bestRemainder = raw.get(best).subtract(BigDecimal.valueOf(counts.get(best)));
                // Strict comparison deliberately keeps the earlier display order on ties.
                if (candidateRemainder.compareTo(bestRemainder) > 0) {
                    best = index;
                }
            }
            counts.set(best, counts.get(best) + 1);
        }
        return List.copyOf(counts);
    }
}
