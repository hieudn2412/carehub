package vn.vietduc.carehubbackend.questiongeneration.service;

import java.util.Collection;
import java.util.Set;

public final class DocumentChunkQualityRules {
    public static final String LOW_INFORMATION_DENSITY = "LOW_INFORMATION_DENSITY";
    public static final String HEADING_ONLY = "HEADING_ONLY";
    public static final String DUPLICATE_TEXT = "DUPLICATE_TEXT";
    public static final String TABLE_LIKE_LOW_CONFIDENCE = "TABLE_LIKE_LOW_CONFIDENCE";
    public static final String ABOVE_TARGET_TOKEN_RANGE = "ABOVE_TARGET_TOKEN_RANGE";
    public static final String LOW_SECTION_CONFIDENCE = "LOW_SECTION_CONFIDENCE";

    private static final Set<String> BLOCKING_FLAGS = Set.of(
            LOW_INFORMATION_DENSITY,
            HEADING_ONLY,
            DUPLICATE_TEXT,
            TABLE_LIKE_LOW_CONFIDENCE
    );

    private DocumentChunkQualityRules() {
    }

    public static boolean isGenerationEligible(Collection<String> flags) {
        if (flags == null || flags.isEmpty()) {
            return true;
        }
        return flags.stream().noneMatch(BLOCKING_FLAGS::contains);
    }
}
