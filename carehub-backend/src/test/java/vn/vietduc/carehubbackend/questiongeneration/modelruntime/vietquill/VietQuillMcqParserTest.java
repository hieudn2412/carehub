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
}
