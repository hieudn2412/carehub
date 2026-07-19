package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelInput;

import static org.assertj.core.api.Assertions.assertThat;

class VietQuillPromptBuilderTest {
    private final VietQuillPromptBuilder builder = new VietQuillPromptBuilder();

    @Test
    void buildFullMcqContainsAllFields() {
        String prompt = builder.buildFullMcq(new ParaphraseModelInput(
                "Câu hỏi gốc?",
                "Đáp án A gốc.",
                "Đáp án B gốc.",
                "Đáp án C gốc.",
                "Đáp án D gốc.",
                "A",
                "medium",
                3
        ));

        assertThat(prompt).contains("paraphrase mcq:");
        assertThat(prompt).contains("Câu hỏi: Câu hỏi gốc?");
        assertThat(prompt).contains("A. Đáp án A gốc.");
        assertThat(prompt).contains("B. Đáp án B gốc.");
        assertThat(prompt).contains("C. Đáp án C gốc.");
        assertThat(prompt).contains("D. Đáp án D gốc.");
        assertThat(prompt).contains("Đáp án đúng: A");
        assertThat(prompt).contains("Mức độ thay đổi: vừa");
        assertThat(prompt).contains("Biến thể số: 1");
        assertThat(prompt).contains("diễn đạt lại toàn bộ câu hỏi và 4 phương án A/B/C/D");
        assertThat(prompt).contains("Trả lại đúng format:");
    }

    @Test
    void buildFullMcqHandlesNullFields() {
        String prompt = builder.buildFullMcq(new ParaphraseModelInput(
                null, null, null, null, null, null, "medium", 3
        ));

        // Không bị NPE, dùng empty string
        assertThat(prompt).contains("Câu hỏi: ");
        assertThat(prompt).contains("A. ");
        assertThat(prompt).contains("Đáp án đúng: ");
    }

    @Test
    void buildSingleFieldWrapsText() {
        String prompt = builder.buildSingleField("Đây là một câu hỏi cần paraphrase.");

        assertThat(prompt).isEqualTo("paraphrase: Đây là một câu hỏi cần paraphrase.");
    }

    @Test
    void buildSingleFieldHandlesNull() {
        String prompt = builder.buildSingleField(null);

        assertThat(prompt).isEqualTo("paraphrase: ");
    }

    @Test
    void buildFullMcqUsesChangeStrengthAndRetryInstruction() {
        String prompt = builder.buildFullMcq(new ParaphraseModelInput(
                "Câu hỏi", "A", "B", "C", "D", "A", "high", 1
        ), 2, true);

        assertThat(prompt).contains("Mức độ thay đổi: mạnh");
        assertThat(prompt).contains("Biến thể số: 3");
        assertThat(prompt).contains("Không được giữ nguyên nguyên văn bất kỳ field nào");
    }
}
