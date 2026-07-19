package vn.vietduc.carehubbackend.questiongeneration.modelruntime.vietquill;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphraseModelException;
import vn.vietduc.carehubbackend.questiongeneration.modelruntime.ParaphrasedMcq;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class VietQuillMcqParserTest {
    private final VietQuillMcqParser parser = new VietQuillMcqParser();

    @Test
    void parsesFullMcqOutput() {
        ParaphrasedMcq result = parser.parse("""
                Câu hỏi: Khi xác định người bệnh, nhân viên cần làm gì?
                A. Đối chiếu ít nhất hai thông tin nhận diện.
                B. Chỉ hỏi số phòng.
                C. Bỏ qua nếu người bệnh tỉnh.
                D. Dựa vào vị trí giường.
                Đáp án đúng: A
                """);

        assertThat(result.stem()).isEqualTo("Khi xác định người bệnh, nhân viên cần làm gì?");
        assertThat(result.optionA()).isEqualTo("Đối chiếu ít nhất hai thông tin nhận diện.");
        assertThat(result.optionD()).isEqualTo("Dựa vào vị trí giường.");
    }

    @Test
    void rejectsOutputWithoutAllOptions() {
        assertThatThrownBy(() -> parser.parse("""
                Câu hỏi: Cần làm gì?
                A. Đáp án A
                B. Đáp án B
                """))
                .isInstanceOf(ParaphraseModelException.class)
                .hasMessageContaining("phương án C");
    }

    @Test
    void parseFullMcqFallsBackToHeuristicWhenRegexFails() {
        // Output không theo format chuẩn — thiếu label "A." cho option A
        ParaphrasedMcq result = parser.parseFullMcq("""
                Câu hỏi: Trước khi tiêm, điều dưỡng cần làm gì?
                A Kiểm tra ít nhất hai thông tin.
                B Hỏi số phòng.
                C Dựa vào vị trí giường.
                D Bỏ qua bước xác định.
                """);

        assertThat(result.stem()).isEqualTo("Trước khi tiêm, điều dưỡng cần làm gì?");
        assertThat(result.optionA()).isEqualTo("Kiểm tra ít nhất hai thông tin.");
        assertThat(result.optionB()).isEqualTo("Hỏi số phòng.");
        assertThat(result.optionC()).isEqualTo("Dựa vào vị trí giường.");
        assertThat(result.optionD()).isEqualTo("Bỏ qua bước xác định.");
    }

    @Test
    void parseFullMcqUsesRegexWhenFormatIsCorrect() {
        // Output đúng format chuẩn — regex parser hoạt động
        ParaphrasedMcq result = parser.parseFullMcq("""
                Câu hỏi: Điều dưỡng cần làm gì khi tiêm thuốc?
                A. Đối chiếu thông tin.
                B. Hỏi số phòng.
                C. Dựa vào giường.
                D. Bỏ qua xác định.
                """);

        assertThat(result.stem()).isEqualTo("Điều dưỡng cần làm gì khi tiêm thuốc?");
        assertThat(result.optionA()).isEqualTo("Đối chiếu thông tin.");
        assertThat(result.optionB()).isEqualTo("Hỏi số phòng.");
        assertThat(result.optionC()).isEqualTo("Dựa vào giường.");
        assertThat(result.optionD()).isEqualTo("Bỏ qua xác định.");
    }

    @Test
    void heuristicRejectsMissingOptions() {
        assertThatThrownBy(() -> parser.parseFullMcq("""
                Câu hỏi: Test stem
                A. Option A text
                B. Option B text
                """))
                .isInstanceOf(ParaphraseModelException.class)
                .hasMessageContaining("thiếu câu hỏi hoặc một trong các phương án");
    }

    @Test
    void heuristicHandlesOutputWithNoStemLabel() {
        // Không có label "Câu hỏi:" — dùng dòng đầu không rỗng làm stem
        ParaphrasedMcq result = parser.parseFullMcq("""
                Đây là câu hỏi không có label
                A. Đáp án A
                B. Đáp án B
                C. Đáp án C
                D. Đáp án D
                """);

        assertThat(result.stem()).isEqualTo("Đây là câu hỏi không có label");
        assertThat(result.optionA()).isEqualTo("Đáp án A");
    }

    @Test
    void heuristicThrowsWhenNoStemFound() {
        assertThatThrownBy(() -> parser.parseFullMcq(""))
                .isInstanceOf(ParaphraseModelException.class)
                .hasMessageContaining("Không parse được output VietQuill");
    }
}
