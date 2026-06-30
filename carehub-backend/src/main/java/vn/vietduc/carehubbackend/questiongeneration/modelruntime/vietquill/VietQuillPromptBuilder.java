package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;

@Component
public class VietQuillPromptBuilder {

    public String build(ParaphraseModelInput input) {
        return """
                paraphrase mcq:
                Câu hỏi: %s
                A. %s
                B. %s
                C. %s
                D. %s
                Đáp án đúng: %s
                Yêu cầu: diễn đạt lại câu hỏi và các phương án, giữ nguyên nghĩa, giữ nguyên số liệu/thuật ngữ y khoa và giữ nguyên đáp án đúng. Trả lại đúng format Câu hỏi/A/B/C/D.
                """.formatted(
                safe(input.stem()),
                safe(input.optionA()),
                safe(input.optionB()),
                safe(input.optionC()),
                safe(input.optionD()),
                safe(input.correctAnswer())
        ).trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
