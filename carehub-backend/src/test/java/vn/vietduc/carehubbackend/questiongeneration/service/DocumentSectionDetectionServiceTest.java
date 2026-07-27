package vn.vietduc.carehubbackend.questiongeneration.service;

import org.junit.jupiter.api.Test;
import vn.vietduc.carehubbackend.questiongeneration.service.model.NormalizedParagraph;
import vn.vietduc.carehubbackend.questiongeneration.service.model.SectionBlock;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentSectionDetectionServiceTest {

    @Test
    void markdownHeadingMarkersBecomeCleanSectionTree() {
        DocumentSectionDetectionService service = new DocumentSectionDetectionService();

        List<SectionBlock> sections = service.detectSections(List.of(
                new NormalizedParagraph("# Đại cương", 1),
                new NormalizedParagraph("Nội dung phần đại cương.", 1),
                new NormalizedParagraph("## Đặc điểm sinh lý", 1),
                new NormalizedParagraph("Nội dung phần sinh lý.", 1)
        ));

        assertThat(sections).hasSize(2);
        assertThat(sections.get(0).title()).isEqualTo("Đại cương");
        assertThat(sections.get(0).path()).isEqualTo("Đại cương");
        assertThat(sections.get(1).title()).isEqualTo("Đặc điểm sinh lý");
        assertThat(sections.get(1).path()).isEqualTo("Đại cương > Đặc điểm sinh lý");
        assertThat(sections.get(1).level()).isEqualTo(2);
    }

    /**
     * Câu bắt đầu bằng một con số là chuyện rất thường trong tài liệu y tế ("5 phút sau khi
     * tiêm…", "24 giờ đầu sau mổ…"). Nhận nhầm chúng là tiêu đề sẽ khiến nội dung biến mất
     * khỏi chunk gửi cho LLM mà không có log nào.
     */
    @Test
    void sentencesStartingWithABareNumberAreContentNotHeadings() {
        assertThat(DocumentSectionDetectionService.looksLikeHeading(
                "5 phút sau khi tiêm cần theo dõi mạch và huyết áp.")).isFalse();
        assertThat(DocumentSectionDetectionService.looksLikeHeading(
                "24 giờ đầu sau mổ là giai đoạn nguy hiểm nhất.")).isFalse();
        assertThat(DocumentSectionDetectionService.looksLikeHeading(
                "3 dấu hiệu cảnh báo sớm của sốc phản vệ gồm mạch nhanh và tụt huyết áp.")).isFalse();
    }

    @Test
    void stillRecognisesGenuineNumberedHeadings() {
        assertThat(DocumentSectionDetectionService.looksLikeHeading("1. Đại cương")).isTrue();
        assertThat(DocumentSectionDetectionService.looksLikeHeading("2) Chỉ định và chống chỉ định")).isTrue();
        assertThat(DocumentSectionDetectionService.looksLikeHeading("1.2.1 Đặc điểm sinh lý")).isTrue();
    }

    /**
     * Nhận diện tiêu đề là heuristic nên sẽ có lúc sai. Dù sai hay đúng, text của dòng đó phải
     * luôn nằm trong nội dung section — nếu không thì một danh sách quy trình đánh số sẽ tạo ra
     * toàn section rỗng và không sinh được chunk nào.
     */
    @Test
    void headingTextIsAlsoKeptAsSectionContentSoNothingIsEverLost() {
        DocumentSectionDetectionService service = new DocumentSectionDetectionService();

        List<SectionBlock> sections = service.detectSections(List.of(
                new NormalizedParagraph("1. Rửa tay bằng xà phòng và nước sạch", 1),
                new NormalizedParagraph("2. Đeo găng vô khuẩn trước khi thao tác", 1)
        ));

        assertThat(sections).hasSize(2);
        assertThat(sections).allSatisfy(section ->
                assertThat(section.paragraphs()).isNotEmpty());
        assertThat(sections.get(0).paragraphs())
                .extracting(NormalizedParagraph::text)
                .contains("1. Rửa tay bằng xà phòng và nước sạch");
    }
}
