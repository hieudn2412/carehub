package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record SectionBlock(
        String title,
        int level,
        int orderIndex,
        Integer parentOrderIndex,
        Integer pageStart,
        Integer pageEnd,
        String path,
        double confidence,
        List<NormalizedParagraph> paragraphs
) {
}
