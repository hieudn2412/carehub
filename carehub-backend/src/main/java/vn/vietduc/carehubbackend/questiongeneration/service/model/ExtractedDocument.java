package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.util.List;

public record ExtractedDocument(
        List<String> pages,
        int pageCount,
        boolean ocrRequired,
        String errorMessage
) {
}
