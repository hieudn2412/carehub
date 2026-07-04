package vn.vietduc.carehubbackend.questiongeneration.service;

import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DocumentSectionDetectionService {
    private static final Pattern CHAPTER = Pattern.compile("^(?:Chương|CHUONG|CHƯƠNG)\\s+\\S+.*", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern MARKDOWN_HEADING = Pattern.compile("^(#{1,6})\\s+\\S.+");
    private static final Pattern NUMBERED = Pattern.compile("^(\\d+(?:\\.\\d+){0,3})[.)]?\\s+\\S.+");
    private static final Pattern ROMAN = Pattern.compile("^(?:[IVXLCDM]{1,6})[.)]\\s+\\S.+");
    private static final Pattern LETTER = Pattern.compile("^[A-Z][.)]\\s+\\S.+");

    public List<SectionBlock> detectSections(List<NormalizedParagraph> paragraphs) {
        List<SectionAccumulator> sections = new ArrayList<>();
        Map<Integer, SectionAccumulator> stack = new HashMap<>();
        SectionAccumulator current = null;

        for (NormalizedParagraph paragraph : paragraphs) {
            String text = paragraph.text();
            if (looksLikeHeading(text)) {
                int level = headingLevel(text);
                String title = cleanHeadingTitle(text);
                SectionAccumulator parent = nearestParent(stack, level);
                current = new SectionAccumulator(
                        title,
                        level,
                        sections.size(),
                        parent == null ? null : parent.orderIndex,
                        parent == null ? title : parent.path + " > " + title,
                        0.82
                );
                current.includePage(paragraph.pageNumber());
                sections.add(current);
                stack.put(level, current);
                stack.keySet().removeIf(existingLevel -> existingLevel > level);
                continue;
            }
            if (current == null) {
                current = new SectionAccumulator(
                        "Nội dung tài liệu",
                        1,
                        sections.size(),
                        null,
                        "Nội dung tài liệu",
                        0.45
                );
                sections.add(current);
                stack.put(1, current);
            }
            current.paragraphs.add(paragraph);
            current.includePage(paragraph.pageNumber());
        }

        return sections.stream()
                .map(SectionAccumulator::toBlock)
                .toList();
    }

    public static boolean looksLikeHeading(String text) {
        if (text == null) {
            return false;
        }
        String value = text.trim();
        if (value.length() < 4 || value.length() > 160) {
            return false;
        }
        return CHAPTER.matcher(value).matches()
                || MARKDOWN_HEADING.matcher(value).matches()
                || NUMBERED.matcher(value).matches()
                || ROMAN.matcher(value).matches()
                || LETTER.matcher(value).matches()
                || looksLikeUppercaseHeading(value);
    }

    private static boolean looksLikeUppercaseHeading(String value) {
        if (value.length() > 90 || value.endsWith(".")) {
            return false;
        }
        int letters = 0;
        int uppercase = 0;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isLetter(c)) {
                letters++;
                if (Character.isUpperCase(c)) {
                    uppercase++;
                }
            }
        }
        return letters >= 6 && uppercase >= Math.ceil(letters * 0.75);
    }

    private int headingLevel(String text) {
        Matcher markdown = MARKDOWN_HEADING.matcher(text);
        if (markdown.matches()) {
            return Math.min(3, markdown.group(1).length());
        }
        if (CHAPTER.matcher(text).matches() || ROMAN.matcher(text).matches()) {
            return 1;
        }
        Matcher matcher = NUMBERED.matcher(text);
        if (matcher.matches()) {
            return Math.min(3, matcher.group(1).split("\\.").length);
        }
        if (LETTER.matcher(text).matches()) {
            return 2;
        }
        return 2;
    }

    private String cleanHeadingTitle(String text) {
        Matcher markdown = MARKDOWN_HEADING.matcher(text);
        if (markdown.matches()) {
            return text.replaceFirst("^#{1,6}\\s+", "").trim();
        }
        return text;
    }

    private SectionAccumulator nearestParent(Map<Integer, SectionAccumulator> stack, int level) {
        for (int candidateLevel = level - 1; candidateLevel >= 1; candidateLevel--) {
            SectionAccumulator parent = stack.get(candidateLevel);
            if (parent != null) {
                return parent;
            }
        }
        return null;
    }

    private static class SectionAccumulator {
        private final String title;
        private final int level;
        private final int orderIndex;
        private final Integer parentOrderIndex;
        private final String path;
        private final double confidence;
        private final List<NormalizedParagraph> paragraphs = new ArrayList<>();
        private Integer pageStart;
        private Integer pageEnd;

        private SectionAccumulator(String title, int level, int orderIndex, Integer parentOrderIndex, String path, double confidence) {
            this.title = title;
            this.level = level;
            this.orderIndex = orderIndex;
            this.parentOrderIndex = parentOrderIndex;
            this.path = path;
            this.confidence = confidence;
        }

        private void includePage(Integer pageNumber) {
            if (pageNumber == null) {
                return;
            }
            pageStart = pageStart == null ? pageNumber : Math.min(pageStart, pageNumber);
            pageEnd = pageEnd == null ? pageNumber : Math.max(pageEnd, pageNumber);
        }

        private SectionBlock toBlock() {
            return new SectionBlock(
                    title,
                    level,
                    orderIndex,
                    parentOrderIndex,
                    pageStart,
                    pageEnd,
                    path,
                    confidence,
                    List.copyOf(paragraphs)
            );
        }
    }
}
