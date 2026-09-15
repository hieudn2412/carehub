package vn.vietduc.carehubbackend.questiongeneration.service;

import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

@Service
public class DocumentTextPreprocessor {
    private static final Pattern PAGE_NUMBER = Pattern.compile("^(?:trang\\s*)?\\d{1,4}(?:\\s*/\\s*\\d{1,4})?$", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern WHITESPACE = Pattern.compile("[\\t\\x0B\\f ]+");
    private static final Pattern LIST_MARKER = Pattern.compile("^(?:[-*•]|\\d+[.)]|[a-zA-Z][.)])\\s+.+");

    public List<NormalizedParagraph> preprocessPages(List<String> pages) {
        List<LineItem> lines = normalizeLines(pages);
        Map<String, Integer> repeated = countRepeatedShortLines(lines);
        List<NormalizedParagraph> paragraphs = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        Integer currentPage = null;

        for (LineItem line : lines) {
            if (line.text().isBlank()) {
                flush(paragraphs, current, currentPage);
                currentPage = null;
                continue;
            }
            if (shouldSkip(line, repeated)) {
                continue;
            }
            if (startsStandaloneParagraph(line.text())) {
                flush(paragraphs, current, currentPage);
                paragraphs.add(new NormalizedParagraph(line.text(), line.pageNumber()));
                currentPage = null;
                continue;
            }
            if (current.length() == 0) {
                current.append(line.text());
                currentPage = line.pageNumber();
            } else if (current.toString().endsWith("-")) {
                current.deleteCharAt(current.length() - 1).append(line.text());
            } else {
                current.append(' ').append(line.text());
            }
        }
        flush(paragraphs, current, currentPage);
        return paragraphs;
    }

    private List<LineItem> normalizeLines(List<String> pages) {
        List<LineItem> lines = new ArrayList<>();
        for (int i = 0; i < pages.size(); i++) {
            String normalized = Normalizer.normalize(nullToEmpty(pages.get(i)), Normalizer.Form.NFC)
                    .replace('\u00A0', ' ')
                    .replace("\r\n", "\n")
                    .replace('\r', '\n');
            String[] rawLines = normalized.split("\\n", -1);
            List<Integer> nonBlank = new ArrayList<>();
            for (int index = 0; index < rawLines.length; index++) {
                if (!WHITESPACE.matcher(rawLines[index].trim()).replaceAll(" ").isBlank()) nonBlank.add(index);
            }
            Set<Integer> edgeLines = new HashSet<>();
            nonBlank.stream().limit(3).forEach(edgeLines::add);
            nonBlank.stream().skip(Math.max(0, nonBlank.size() - 3L)).forEach(edgeLines::add);
            for (int index = 0; index < rawLines.length; index++) {
                String line = WHITESPACE.matcher(rawLines[index].trim()).replaceAll(" ");
                lines.add(new LineItem(line, i + 1, edgeLines.contains(index)));
            }
        }
        return lines;
    }

    private Map<String, Integer> countRepeatedShortLines(List<LineItem> lines) {
        Map<String, Set<Integer>> pagesByLine = new HashMap<>();
        for (LineItem line : lines) {
            String text = line.text();
            if (line.pageEdge() && text.length() >= 3 && text.length() <= 80) {
                pagesByLine.computeIfAbsent(text.toLowerCase(Locale.ROOT), ignored -> new HashSet<>())
                        .add(line.pageNumber());
            }
        }
        Map<String, Integer> counts = new HashMap<>();
        pagesByLine.forEach((line, pageNumbers) -> counts.put(line, pageNumbers.size()));
        return counts;
    }

    private boolean shouldSkip(LineItem item, Map<String, Integer> repeated) {
        String line = item.text();
        if (PAGE_NUMBER.matcher(line).matches()) {
            return true;
        }
        String key = line.toLowerCase(Locale.ROOT);
        return item.pageEdge() && repeated.getOrDefault(key, 0) >= 3 && line.length() <= 80;
    }

    private boolean startsStandaloneParagraph(String line) {
        return LIST_MARKER.matcher(line).matches() || DocumentSectionDetectionService.looksLikeHeading(line);
    }

    private void flush(List<NormalizedParagraph> paragraphs, StringBuilder current, Integer pageNumber) {
        String text = current.toString().trim();
        if (!text.isBlank()) {
            paragraphs.add(new NormalizedParagraph(text, pageNumber));
        }
        current.setLength(0);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private record LineItem(String text, Integer pageNumber, boolean pageEdge) {
    }
}
