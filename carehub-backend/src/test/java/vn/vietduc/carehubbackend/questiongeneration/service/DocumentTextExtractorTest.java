package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentTextExtractorTest {
    private final DocumentTextExtractor extractor = new DocumentTextExtractor();

    @Test
    void rejectsExtensionSpoofingAndInvalidUtf8() {
        assertThat(extractor.extract("not a pdf".getBytes(java.nio.charset.StandardCharsets.UTF_8), "guide.pdf")
                .errorMessage()).contains("không phải PDF");
        assertThat(extractor.extract(new byte[]{(byte) 0xC3, (byte) 0x28}, "guide.txt")
                .errorMessage()).contains("Không thể đọc nội dung");
        assertThat(extractor.extract(new byte[]{'a', 0, 'b'}, "guide.md")
                .errorMessage()).contains("byte NUL");
    }
}
