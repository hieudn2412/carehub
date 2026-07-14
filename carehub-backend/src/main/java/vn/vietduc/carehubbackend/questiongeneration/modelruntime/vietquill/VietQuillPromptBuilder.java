package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.springframework.stereotype.Component;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;

@Component
public class VietQuillPromptBuilder {

    /**
     * Build prompt cho single-pass full MCQ paraphrase.
     * Model được yêu cầu output toàn bộ MCQ (Câu hỏi + A/B/C/D) trong 1 lần.
     */
    public String buildFullMcq(ParaphraseModelInput input) {
        return """
                paraphrase mcq:
                Câu hỏi: %s
                A. %s
                B. %s
                C. %s
                D. %s
                Đáp án đúng: %s
                Yêu cầu: diễn đạt lại toàn bộ câu hỏi và 4 phương án A/B/C/D, giữ nguyên nghĩa, \
                giữ nguyên số liệu/thuật ngữ y khoa và giữ nguyên đáp án đúng. \
                Trả lại đúng format:
                Câu hỏi: <stem mới>
                A. <option A mới>
                B. <option B mới>
                C. <option C mới>
                D. <option D mới>
                """.formatted(
                safe(input.stem()),
                safe(input.optionA()),
                safe(input.optionB()),
                safe(input.optionC()),
                safe(input.optionD()),
                safe(input.correctAnswer())
        ).trim();
    }

    /**
     * Build prompt cho single field (giữ lại cho fallback hoặc sentence model).
     */
    public String buildSingleField(String text) {
        return "paraphrase: " + safe(text);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
