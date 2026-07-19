package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelException;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class VietQuillMcqParser {
    private static final Pattern STEM = Pattern.compile(
            "(?is)(?:Câu hỏi|Question)\\s*[:：]\\s*(.*?)(?=\\n\\s*(?:A|B)\\s*[\\).:：])"
    );
    private static final Pattern OPTION = Pattern.compile(
            "(?ims)^\\s*%s\\s*[\\).:：]\\s*(.*?)(?=^\\s*[ABCD]\\s*[\\).:：]|\\z)"
    );

    /**
     * Attempt to parse model output as full MCQ. The heuristic parser is only
     * accepted when it still contains every required field.
     */
    public ParaphrasedMcq parseFullMcq(String rawOutput) {
        try {
            return requireComplete(parse(rawOutput));
        } catch (ParaphraseModelException ex) {
            return requireComplete(parseHeuristic(rawOutput));
        }
    }

    public ParaphrasedMcq parse(String rawOutput) {
        String normalized = normalize(rawOutput);
        String stem = match(STEM, normalized, "Không tìm thấy phần Câu hỏi trong output VietQuill");
        String optionA = match(optionPattern("A"), normalized, "Không tìm thấy phương án A trong output VietQuill");
        String optionB = match(optionPattern("B"), normalized, "Không tìm thấy phương án B trong output VietQuill");
        String optionC = match(optionPattern("C"), normalized, "Không tìm thấy phương án C trong output VietQuill");
        String optionD = match(optionPattern("D"), normalized, "Không tìm thấy phương án D trong output VietQuill");
        return new ParaphrasedMcq(stem, optionA, optionB, optionC, optionD, rawOutput);
    }

    /**
     * Fallback heuristic parser khi model output không theo format chuẩn.
     * Dùng newline-based heuristic để extract stem + options.
     */
    private ParaphrasedMcq parseHeuristic(String rawOutput) {
        String normalized = normalize(rawOutput);
        String[] lines = normalized.split("\n");

        String stem = null;
        String optionA = null;
        String optionB = null;
        String optionC = null;
        String optionD = null;

        Pattern stemLine = Pattern.compile("(?i)^\\s*(?:Câu hỏi|Question)\\s*[:：]\\s*(.*)");
        Pattern optionLine = Pattern.compile("(?i)^\\s*([ABCD])\\s*[\\).:：]?\\s+(.*)");

        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.isBlank()) {
                continue;
            }

            Matcher stemMatcher = stemLine.matcher(trimmed);
            if (stemMatcher.matches()) {
                stem = stemMatcher.group(1).trim();
                continue;
            }

            Matcher optionMatcher = optionLine.matcher(trimmed);
            if (optionMatcher.matches()) {
                String label = optionMatcher.group(1).toUpperCase();
                String text = optionMatcher.group(2).trim();
                switch (label) {
                    case "A" -> optionA = text;
                    case "B" -> optionB = text;
                    case "C" -> optionC = text;
                    case "D" -> optionD = text;
                }
                continue;
            }

            // Fallback: nếu chưa tìm thấy stem, dùng dòng đầu tiên không rỗng làm stem
            if (stem == null && !trimmed.matches("(?i)^\\s*Đáp án.*")) {
                stem = trimmed;
            }
        }

        if (stem == null || stem.isBlank()) {
            throw new ParaphraseModelException(
                    "Không parse được output VietQuill (cả regex lẫn heuristic đều thất bại): " + rawOutput);
        }

        return new ParaphrasedMcq(
                stem,
                optionA != null ? optionA : "",
                optionB != null ? optionB : "",
                optionC != null ? optionC : "",
                optionD != null ? optionD : "",
                rawOutput
        );
    }

    private ParaphrasedMcq requireComplete(ParaphrasedMcq result) {
        if (result == null
                || isBlank(result.stem())
                || isBlank(result.optionA())
                || isBlank(result.optionB())
                || isBlank(result.optionC())
                || isBlank(result.optionD())) {
            throw new ParaphraseModelException("Output VietQuill thiếu câu hỏi hoặc một trong các phương án A/B/C/D");
        }
        return result;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private Pattern optionPattern(String label) {
        return Pattern.compile(OPTION.pattern().formatted(label), OPTION.flags());
    }

    private String normalize(String rawOutput) {
        return (rawOutput == null ? "" : rawOutput)
                .replace("\r\n", "\n")
                .replace("\r", "\n")
                .trim();
    }

    private String match(Pattern pattern, String value, String error) {
        Matcher matcher = pattern.matcher(value);
        if (!matcher.find()) {
            throw new ParaphraseModelException(error);
        }
        String result = matcher.group(1)
                .replaceAll("(?im)^\\s*Đáp án đúng\\s*[:：].*$", "")
                .replaceAll("\\s+", " ")
                .trim();
        if (result.isBlank()) {
            throw new ParaphraseModelException(error);
        }
        return result;
    }
}
