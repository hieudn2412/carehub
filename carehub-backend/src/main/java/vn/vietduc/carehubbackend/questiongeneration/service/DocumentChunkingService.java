package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ChunkDraft;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DocumentChunkingService {
    private final DocumentProcessingProperties properties;

    public List<ChunkDraft> createGenerationChunks(List<SectionBlock> sections) {
        List<ChunkDraft> chunks = new ArrayList<>();
        for (SectionBlock section : sections) {
            chunks.addAll(chunkSection(section));
        }
        return flagDuplicateChunks(chunks);
    }

    private List<ChunkDraft> chunkSection(SectionBlock section) {
        List<ChunkDraft> chunks = new ArrayList<>();
        List<String> currentParagraphs = new ArrayList<>();
        int currentTokens = 0;
        Integer pageStart = null;
        Integer pageEnd = null;

        for (NormalizedParagraph paragraph : section.paragraphs()) {
            String text = paragraph.text();
            int paragraphTokens = estimateTokens(text);
            if (paragraphTokens == 0) {
                continue;
            }
            if (paragraphTokens > properties.getChunk().getMaxTokens()) {
                if (!currentParagraphs.isEmpty()) {
                    chunks.add(buildChunk(section, currentParagraphs, currentTokens, pageStart, pageEnd));
                    currentParagraphs = new ArrayList<>();
                    currentTokens = 0;
                    pageStart = null;
                    pageEnd = null;
                }
                chunks.addAll(splitLongParagraph(section, paragraph));
                continue;
            }
            if (!currentParagraphs.isEmpty() && currentTokens + paragraphTokens > properties.getChunk().getMaxTokens()) {
                chunks.add(buildChunk(section, currentParagraphs, currentTokens, pageStart, pageEnd));
                String overlap = trailingWords(String.join("\n\n", currentParagraphs), properties.getChunk().getOverlapTokens());
                currentParagraphs = overlap.isBlank() ? new ArrayList<>() : new ArrayList<>(List.of(overlap));
                currentTokens = estimateTokens(overlap);
                pageStart = paragraph.pageNumber();
                pageEnd = paragraph.pageNumber();
            }
            currentParagraphs.add(text);
            currentTokens += paragraphTokens;
            pageStart = minPage(pageStart, paragraph.pageNumber());
            pageEnd = maxPage(pageEnd, paragraph.pageNumber());
        }

        if (!currentParagraphs.isEmpty()) {
            chunks.add(buildChunk(section, currentParagraphs, currentTokens, pageStart, pageEnd));
        }
        return chunks;
    }

    private List<ChunkDraft> splitLongParagraph(SectionBlock section, NormalizedParagraph paragraph) {
        List<ChunkDraft> chunks = new ArrayList<>();
        List<String> sentences = splitSentences(paragraph.text());
        List<String> current = new ArrayList<>();
        int currentTokens = 0;
        for (String sentence : sentences) {
            int tokens = estimateTokens(sentence);
            if (!current.isEmpty() && currentTokens + tokens > properties.getChunk().getMaxTokens()) {
                chunks.add(buildChunk(section, current, currentTokens, paragraph.pageNumber(), paragraph.pageNumber()));
                String overlap = trailingWords(String.join(" ", current), properties.getChunk().getOverlapTokens());
                current = overlap.isBlank() ? new ArrayList<>() : new ArrayList<>(List.of(overlap));
                currentTokens = estimateTokens(overlap);
            }
            current.add(sentence);
            currentTokens += tokens;
        }
        if (!current.isEmpty()) {
            chunks.add(buildChunk(section, current, currentTokens, paragraph.pageNumber(), paragraph.pageNumber()));
        }
        return chunks;
    }

    private ChunkDraft buildChunk(
            SectionBlock section,
            List<String> paragraphs,
            int tokenCount,
            Integer pageStart,
            Integer pageEnd
    ) {
        String text = String.join("\n\n", paragraphs).trim();
        List<String> flags = new ArrayList<>();
        if (text.length() < properties.getChunk().getMinUsefulTextLength()) {
            flags.add(DocumentChunkQualityRules.LOW_INFORMATION_DENSITY);
        }
        if (isHeadingOnly(text, tokenCount)) {
            flags.add(DocumentChunkQualityRules.HEADING_ONLY);
        }
        if (isTableLikeLowConfidence(text, section.confidence())) {
            flags.add(DocumentChunkQualityRules.TABLE_LIKE_LOW_CONFIDENCE);
        }
        if (tokenCount > properties.getChunk().getTargetTokens()) {
            flags.add(DocumentChunkQualityRules.ABOVE_TARGET_TOKEN_RANGE);
        }
        if (section.confidence() < 0.5) {
            flags.add(DocumentChunkQualityRules.LOW_SECTION_CONFIDENCE);
        }
        return new ChunkDraft(
                section.orderIndex(),
                section.title(),
                section.path(),
                pageStart,
                pageEnd,
                text,
                estimateTokens(text),
                flags
        );
    }

    private List<ChunkDraft> flagDuplicateChunks(List<ChunkDraft> chunks) {
        Set<String> seen = new HashSet<>();
        List<ChunkDraft> flagged = new ArrayList<>();
        for (ChunkDraft chunk : chunks) {
            String normalized = normalizeForDuplicateCheck(chunk.text());
            if (!normalized.isBlank() && !seen.add(normalized)) {
                flagged.add(withFlag(chunk, DocumentChunkQualityRules.DUPLICATE_TEXT));
            } else {
                flagged.add(chunk);
            }
        }
        return flagged;
    }

    private ChunkDraft withFlag(ChunkDraft chunk, String flag) {
        if (chunk.qualityFlags().contains(flag)) {
            return chunk;
        }
        List<String> flags = new ArrayList<>(chunk.qualityFlags());
        flags.add(flag);
        return new ChunkDraft(
                chunk.sectionOrderIndex(),
                chunk.sectionTitle(),
                chunk.sectionPath(),
                chunk.pageStart(),
                chunk.pageEnd(),
                chunk.text(),
                chunk.tokenCount(),
                flags
        );
    }

    private boolean isHeadingOnly(String text, int tokenCount) {
        if (text == null || text.isBlank() || tokenCount > 18) {
            return false;
        }
        String[] lines = text.lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .toArray(String[]::new);
        if (lines.length > 2) {
            return false;
        }
        String withoutNumbering = text.replaceFirst("^\\s*([0-9]+\\.)+\\s*", "");
        return text.matches("(?s).*\\p{L}.*")
                && !withoutNumbering.matches("(?s).*[.!?].*");
    }

    private boolean isTableLikeLowConfidence(String text, double sectionConfidence) {
        if (text == null || sectionConfidence >= 0.65) {
            return false;
        }
        long structuredLines = text.lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .filter(line -> line.contains("|") || line.contains("\t") || line.matches(".*\\s{3,}.*"))
                .count();
        long lines = text.lines()
                .map(String::trim)
                .filter(line -> !line.isBlank())
                .count();
        return lines >= 3 && structuredLines * 2 >= lines;
    }

    private String normalizeForDuplicateCheck(String text) {
        if (text == null) {
            return "";
        }
        return text.toLowerCase()
                .replaceAll("\\s+", " ")
                .trim();
    }

    public int estimateTokens(String text) {
        if (text == null || text.isBlank()) {
            return 0;
        }
        return text.trim().split("\\s+").length;
    }

    private List<String> splitSentences(String paragraph) {
        String[] parts = paragraph.split("(?<=[.!?。])\\s+");
        List<String> sentences = new ArrayList<>();
        for (String part : parts) {
            if (!part.isBlank()) {
                sentences.add(part.trim());
            }
        }
        return sentences.isEmpty() ? List.of(paragraph) : sentences;
    }

    private String trailingWords(String text, int count) {
        if (count <= 0 || text == null || text.isBlank()) {
            return "";
        }
        String[] words = text.trim().split("\\s+");
        int start = Math.max(0, words.length - count);
        return String.join(" ", java.util.Arrays.copyOfRange(words, start, words.length));
    }

    private Integer minPage(Integer current, Integer next) {
        if (next == null) {
            return current;
        }
        return current == null ? next : Math.min(current, next);
    }

    private Integer maxPage(Integer current, Integer next) {
        if (next == null) {
            return current;
        }
        return current == null ? next : Math.max(current, next);
    }
}
