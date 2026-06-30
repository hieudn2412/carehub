package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentTextPreprocessorTest {
    private final DocumentTextPreprocessor preprocessor = new DocumentTextPreprocessor();

    @Test
    void preprocessPagesKeepsVietnameseNegationAndRemovesRepeatedNoise() {
        List<NormalizedParagraph> paragraphs = preprocessor.preprocessPages(List.of(
                "BỆNH VIỆN HỮU NGHỊ VIỆT ĐỨC\n1\nNgười bệnh không được tự ý ngừng thuốc.\nLiều dùng 5 mg trong 24 giờ.",
                "BỆNH VIỆN HỮU NGHỊ VIỆT ĐỨC\n2\nChống chỉ định khi chưa đánh giá nguy cơ.",
                "BỆNH VIỆN HỮU NGHỊ VIỆT ĐỨC\n3\nTheo dõi SpO2 liên tục."
        ));

        String text = paragraphs.stream().map(NormalizedParagraph::text).reduce("", (a, b) -> a + " " + b);

        assertThat(text).contains("không được tự ý ngừng thuốc");
        assertThat(text).contains("Chống chỉ định");
        assertThat(text).contains("5 mg");
        assertThat(text).doesNotContain("BỆNH VIỆN HỮU NGHỊ VIỆT ĐỨC");
        assertThat(text).doesNotContain(" 1 ");
    }

    @Test
    void preprocessPagesJoinsHyphenatedLineBreaks() {
        List<NormalizedParagraph> paragraphs = preprocessor.preprocessPages(List.of(
                "Quy trình kiểm-\nsoát nhiễm khuẩn cần được thực hiện đầy đủ."
        ));

        assertThat(paragraphs).hasSize(1);
        assertThat(paragraphs.get(0).text()).contains("kiểmsoát nhiễm khuẩn");
    }
}
