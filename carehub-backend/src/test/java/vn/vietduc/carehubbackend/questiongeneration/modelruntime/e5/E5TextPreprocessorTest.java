package vn.vietduc.carehubbackend.questiongeneration.modelruntime.e5;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class E5TextPreprocessorTest {

    @Test
    void queryAddsE5PrefixAndNormalizesWhitespace() {
        assertThat(E5TextPreprocessor.query("  Người bệnh   cần SpO2 bao nhiêu?  "))
                .isEqualTo("query: người bệnh cần spo2 bao nhiêu?");
    }

    @Test
    void passageAddsE5PrefixAndKeepsVietnameseMarks() {
        assertThat(E5TextPreprocessor.passage("Đáp án đúng là vệ sinh tay."))
                .isEqualTo("passage: đáp án đúng là vệ sinh tay.");
    }
}
