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
        return buildFullMcq(input, 0, false);
    }

    public String buildFullMcq(ParaphraseModelInput input, int variantIndex, boolean retry) {
        return """
                paraphrase mcq:
                Câu hỏi: %s
                A. %s
                B. %s
                C. %s
                D. %s
                Đáp án đúng: %s
                Mức độ thay đổi: %s
                Biến thể số: %d
                Yêu cầu: diễn đạt lại toàn bộ câu hỏi và 4 phương án A/B/C/D, giữ nguyên nghĩa, \
                giữ nguyên số liệu/thuật ngữ y khoa và giữ nguyên đáp án đúng. \
                %s \
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
                safe(input.correctAnswer()),
                strengthInstruction(input.changeStrength()),
                Math.max(1, variantIndex + 1),
                retry
                        ? "Không được giữ nguyên nguyên văn bất kỳ field nào và không được bỏ sót phương án."
                        : "Mỗi field phải được diễn đạt lại, không sao chép nguyên văn câu nguồn."
        ).trim();
    }

    /**
     * Build prompt cho single field (giữ lại cho fallback hoặc sentence model).
     */
    public String buildSingleField(String text) {
        return "paraphrase: " + safe(text);
    }

    public String buildSingleField(String text, String changeStrength, int variantIndex, boolean retry) {
        return "paraphrase: " + safe(text)
                + "\nMức độ thay đổi: " + strengthInstruction(changeStrength)
                + "\nBiến thể số: " + Math.max(1, variantIndex + 1)
                + "\nYêu cầu: diễn đạt lại, giữ nguyên nghĩa và thuật ngữ/số liệu."
                + (retry ? " Không được giữ nguyên nguyên văn." : "");
    }

    private String strengthInstruction(String value) {
        return switch (safe(value).toLowerCase()) {
            case "low", "nhẹ" -> "nhẹ - thay đổi từ ngữ và cấu trúc ở mức tối thiểu";
            case "high", "mạnh" -> "mạnh - có thể đảo cấu trúc câu nhưng tuyệt đối không đổi nghĩa";
            default -> "vừa - diễn đạt tự nhiên hơn nhưng vẫn giữ ý nghĩa gốc";
        };
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
