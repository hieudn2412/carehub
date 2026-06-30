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

    public ParaphrasedMcq parse(String rawOutput) {
        String normalized = normalize(rawOutput);
        String stem = match(STEM, normalized, "Không tìm thấy phần Câu hỏi trong output VietQuill");
        String optionA = match(optionPattern("A"), normalized, "Không tìm thấy phương án A trong output VietQuill");
        String optionB = match(optionPattern("B"), normalized, "Không tìm thấy phương án B trong output VietQuill");
        String optionC = match(optionPattern("C"), normalized, "Không tìm thấy phương án C trong output VietQuill");
        String optionD = match(optionPattern("D"), normalized, "Không tìm thấy phương án D trong output VietQuill");
        return new ParaphrasedMcq(stem, optionA, optionB, optionC, optionD, rawOutput);
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
