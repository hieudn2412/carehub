package vn.vietduc.carehubbackend.questiongeneration.generation;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.config.AiGenerationProperties;
import vn.vietduc.carehubbackend.questiongeneration.service.model.GenerationInput;

import static org.assertj.core.api.Assertions.assertThat;

class MockDocumentQuestionGeneratorTest {

    @Test
    void generateUsesStandaloneQuestionStem() {
        MockDocumentQuestionGenerator generator = new MockDocumentQuestionGenerator(
                new AiGenerationProperties(),
                new ObjectMapper()
        );

        var result = generator.generate(new GenerationInput(
                1L,
                2L,
                3L,
                "Xuất huyết tiêu hóa có thể gây mạch nhanh và huyết áp tụt. Người bệnh cần được theo dõi sát.",
                "1. ĐẠI CƯƠNG > 1.2.1. Đặc điểm sinh lý",
                1,
                "vi"
        ));

        assertThat(result.questions()).hasSize(1);
        assertThat(result.questions().get(0).stem()).isEqualTo("Nội dung nào mô tả đúng về Đặc điểm sinh lý?");
        assertThat(result.questions().get(0).stem()).doesNotStartWith("Theo tài liệu");
    }
}
