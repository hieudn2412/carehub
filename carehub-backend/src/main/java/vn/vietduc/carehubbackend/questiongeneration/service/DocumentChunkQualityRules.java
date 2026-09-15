package vn.vietduc.carehubbackend.questiongeneration.service;

import java.util.Collection;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class DocumentChunkQualityRules {
    public static final String LOW_INFORMATION_DENSITY = "LOW_INFORMATION_DENSITY";
    public static final String HEADING_ONLY = "HEADING_ONLY";
    public static final String DUPLICATE_TEXT = "DUPLICATE_TEXT";
    public static final String TABLE_LIKE_LOW_CONFIDENCE = "TABLE_LIKE_LOW_CONFIDENCE";
    public static final String BIBLIOGRAPHY_LIKE = "BIBLIOGRAPHY_LIKE";
    public static final String ABOVE_TARGET_TOKEN_RANGE = "ABOVE_TARGET_TOKEN_RANGE";
    public static final String LOW_SECTION_CONFIDENCE = "LOW_SECTION_CONFIDENCE";

    private static final Set<String> BLOCKING_FLAGS = Set.of(
            LOW_INFORMATION_DENSITY,
            HEADING_ONLY,
            DUPLICATE_TEXT,
            TABLE_LIKE_LOW_CONFIDENCE,
            BIBLIOGRAPHY_LIKE
    );
    private static final Pattern CITATION_YEAR = Pattern.compile("(?:^|\\D)(?:19|20)\\d{2}(?:\\D|$)");
    private static final Pattern CITATION_MARKER = Pattern.compile(
            "(?i)(?:\\bet\\s+al\\b|\\bdoi\\b|https?://|\\bvol\\.?\\s*\\d|\\bpp?\\.?\\s*\\d|\\bISBN\\b)"
    );

    private DocumentChunkQualityRules() {
    }

    public static boolean isGenerationEligible(Collection<String> flags) {
        if (flags == null || flags.isEmpty()) {
            return true;
        }
        return flags.stream().noneMatch(BLOCKING_FLAGS::contains);
    }

    /** Conservative runtime guard, including chunks persisted before the quality flag existed. */
    public static boolean isBibliographyLike(String sectionPath, String text) {
        String section = normalize(sectionPath);
        if (section.contains("tai lieu tham khao") || section.contains("references")
                || section.contains("bibliography")) {
            return true;
        }
        String value = text == null ? "" : text.trim();
        if (value.isEmpty()) {
            return false;
        }
        int signals = 0;
        if (CITATION_YEAR.matcher(value).find()) signals++;
        if (CITATION_MARKER.matcher(value).find()) signals++;
        if (value.matches("(?s).*\\b[A-Z][a-z]+(?:,|\\s+[A-Z]\\.)[^.]{0,120}\\..*")) signals++;
        return signals >= 2;
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
    }
}
