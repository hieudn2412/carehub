package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record ChunkDraft(
        int sectionOrderIndex,
        String sectionTitle,
        String sectionPath,
        Integer pageStart,
        Integer pageEnd,
        String text,
        int tokenCount,
        List<String> qualityFlags
) {
}
