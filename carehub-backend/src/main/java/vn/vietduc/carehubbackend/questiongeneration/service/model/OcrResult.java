package vn.vietduc.carehubbackend.questiongeneration.service.model;

import java.time.Duration;
import java.util.List;

public record OcrResult(
        List<OcrPageResult> pages,
        int totalPages,
        int pagesWithText,
        double averageConfidence,
        Duration processingTime,
        String engineName
) {
    public boolean hasLowConfidencePages() {
        return pages.stream().anyMatch(p -> p.confidence() < 60.0);
    }

    public List<OcrPageResult> lowConfidencePages() {
        return pages.stream().filter(p -> p.confidence() < 60.0).toList();
    }

    public String combinedText() {
        StringBuilder sb = new StringBuilder();
        for (OcrPageResult page : pages) {
            if (page.text() != null && !page.text().isBlank()) {
                sb.append(page.text()).append("\n\n");
            }
        }
        return sb.toString().trim();
    }
}
