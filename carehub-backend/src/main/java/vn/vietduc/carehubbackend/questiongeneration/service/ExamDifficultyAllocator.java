package vn.vietduc.carehubbackend.questiongeneration.service;

import vn.vietduc.carehubbackend.exception.BadRequestException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

final class ExamDifficultyAllocator {
    static final int DEFAULT_EASY = 30;
    static final int DEFAULT_MEDIUM = 50;
    static final int DEFAULT_HARD = 20;

    private ExamDifficultyAllocator() {
    }

    static Percentages percentages(Integer easy, Integer medium, Integer hard) {
        int resolvedEasy = easy == null ? DEFAULT_EASY : easy;
        int resolvedMedium = medium == null ? DEFAULT_MEDIUM : medium;
        int resolvedHard = hard == null ? DEFAULT_HARD : hard;
        if (resolvedEasy < 0 || resolvedMedium < 0 || resolvedHard < 0
                || resolvedEasy > 100 || resolvedMedium > 100 || resolvedHard > 100
                || resolvedEasy + resolvedMedium + resolvedHard != 100) {
            throw new BadRequestException("Tổng tỷ lệ Dễ, Trung bình và Khó phải bằng 100%");
        }
        return new Percentages(resolvedEasy, resolvedMedium, resolvedHard);
    }

    static Counts allocate(int totalQuestions, Percentages percentages) {
        List<Share> shares = new ArrayList<>(List.of(
                share("EASY", totalQuestions, percentages.easy(), 1),
                share("MEDIUM", totalQuestions, percentages.medium(), 0),
                share("HARD", totalQuestions, percentages.hard(), 2)
        ));
        int allocated = shares.stream().mapToInt(Share::count).sum();
        shares.sort(Comparator.comparingInt(Share::remainder).reversed()
                .thenComparingInt(Share::tieOrder));
        for (int index = 0; index < totalQuestions - allocated; index++) {
            Share share = shares.get(index);
            shares.set(index, share.withCount(share.count() + 1));
        }
        int easy = count(shares, "EASY");
        int medium = count(shares, "MEDIUM");
        int hard = count(shares, "HARD");
        return new Counts(easy, medium, hard);
    }

    static String normalizeDifficulty(String value) {
        if (value == null || value.isBlank()) {
            return "MEDIUM";
        }
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "EASY", "DE", "DỄ" -> "EASY";
            case "HARD", "KHO", "KHÓ" -> "HARD";
            default -> "MEDIUM";
        };
    }

    private static Share share(String difficulty, int total, int percentage, int tieOrder) {
        int product = total * percentage;
        return new Share(difficulty, product / 100, product % 100, tieOrder);
    }

    private static int count(List<Share> shares, String difficulty) {
        return shares.stream()
                .filter(share -> share.difficulty().equals(difficulty))
                .mapToInt(Share::count)
                .findFirst()
                .orElse(0);
    }

    record Percentages(int easy, int medium, int hard) {
    }

    record Counts(int easy, int medium, int hard) {
        int forDifficulty(String difficulty) {
            return switch (normalizeDifficulty(difficulty)) {
                case "EASY" -> easy;
                case "HARD" -> hard;
                default -> medium;
            };
        }
    }

    private record Share(String difficulty, int count, int remainder, int tieOrder) {
        Share withCount(int nextCount) {
            return new Share(difficulty, nextCount, remainder, tieOrder);
        }
    }
}
