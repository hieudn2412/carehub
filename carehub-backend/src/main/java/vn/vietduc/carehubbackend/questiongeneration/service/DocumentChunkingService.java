package vn.vietduc.carehubbackend.questiongeneration.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vietduc.carehubbackend.questiongeneration.config.DocumentProcessingProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.ChunkDraft;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DocumentChunkingService {
    private final DocumentProcessingProperties properties;

    public List<ChunkDraft> createGenerationChunks(List<SectionBlock> sections) {
        List<ChunkDraft> chunks = new ArrayList<>();
        for (SectionBlock section : sections) {
            chunks.addAll(chunkSection(section));
        }
        return chunks;
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
            flags.add("LOW_INFORMATION_DENSITY");
        }
        if (tokenCount > properties.getChunk().getTargetTokens()) {
            flags.add("ABOVE_TARGET_TOKEN_RANGE");
        }
        if (section.confidence() < 0.5) {
            flags.add("LOW_SECTION_CONFIDENCE");
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
